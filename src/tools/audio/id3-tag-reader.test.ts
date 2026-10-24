import { describe, expect, it } from 'vitest';
import tool from './id3-tag-reader.tool';

type Result = {
  outputs: { filename: string; blob: Blob }[];
  report?: { output: string; render?: string };
  notes?: string[];
  warnings?: string[];
  stats?: Record<string, string | number>;
};
type Table = { headers: string[]; rows: string[][] };

const run = async (bytes: number[] | null, options: Record<string, string | number | boolean> = {}) => {
  const files = bytes === null ? [] : [new File([new Uint8Array(bytes)], 'song.mp3', { type: 'audio/mpeg' })];
  return (await tool.run({ files, options })) as Result;
};

const table = async (bytes: number[] | null, options: Record<string, string | number | boolean> = {}) => {
  const r = await run(bytes, options);
  return { r, parsed: JSON.parse(r.report?.output ?? '{}') as Table };
};

const asMap = (rows: string[][]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const key = row[0];
    const value = row[1];
    if (key !== undefined && value !== undefined) out[key] = value;
  }
  return out;
};

/* -------------------------------------------------------------------------- */
/*  ID3 fixture builders                                                      */
/* -------------------------------------------------------------------------- */

function latinBytes(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 1) out.push(text.charCodeAt(i) & 0xff);
  return out;
}

function utf16Bytes(text: string, endian: 'le' | 'be', bom: boolean): number[] {
  const out: number[] = [];
  if (bom) out.push(...(endian === 'le' ? [0xff, 0xfe] : [0xfe, 0xff]));
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (endian === 'le') out.push(code & 0xff, (code >> 8) & 0xff);
    else out.push((code >> 8) & 0xff, code & 0xff);
  }
  return out;
}

const syncsafeBytes = (n: number): number[] => [
  (n >> 21) & 0x7f,
  (n >> 14) & 0x7f,
  (n >> 7) & 0x7f,
  n & 0x7f,
];

const beBytes = (n: number): number[] => [
  (n >>> 24) & 0xff,
  (n >>> 16) & 0xff,
  (n >>> 8) & 0xff,
  n & 0xff,
];

function frameBytes(id: string, data: number[], version: 2 | 3 | 4 = 3): number[] {
  if (version === 2) return [...latinBytes(id), ...beBytes(data.length).slice(1), ...data];
  const size = version === 4 ? syncsafeBytes(data.length) : beBytes(data.length);
  return [...latinBytes(id), ...size, 0, 0, ...data];
}

function textFrame(id: string, text: string, encoding = 0, version: 2 | 3 | 4 = 3): number[] {
  let body: number[];
  if (encoding === 0) body = latinBytes(text);
  else if (encoding === 3) body = Array.from(new TextEncoder().encode(text));
  else body = utf16Bytes(text, encoding === 1 ? 'le' : 'be', encoding === 1);
  return frameBytes(id, [encoding, ...body], version);
}

function tagBytes(frames: number[][], version: 2 | 3 | 4 = 3, flags = 0): number[] {
  const body = frames.flat();
  return [...latinBytes('ID3'), version, 0, flags, ...syncsafeBytes(body.length), ...body];
}

function v1Trailer(fields: {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  comment?: string;
  track?: number;
  genre?: number;
}): number[] {
  const pad = (text: string, length: number): number[] => {
    const bytes = latinBytes(text).slice(0, length);
    while (bytes.length < length) bytes.push(0);
    return bytes;
  };
  const out = [
    ...latinBytes('TAG'),
    ...pad(fields.title ?? '', 30),
    ...pad(fields.artist ?? '', 30),
    ...pad(fields.album ?? '', 30),
    ...pad(fields.year ?? '', 4),
  ];
  if (fields.track !== undefined) out.push(...pad(fields.comment ?? '', 28), 0, fields.track & 0xff);
  else out.push(...pad(fields.comment ?? '', 30));
  out.push(fields.genre ?? 255);
  return out;
}

const BASIC_23 = tagBytes([
  textFrame('TIT2', 'Jóga'),
  textFrame('TPE1', 'Björk'),
  textFrame('TALB', 'Homogenic'),
  textFrame('TYER', '1997'),
  textFrame('TRCK', '3/10'),
  textFrame('TCON', 'Electronic'),
]);

/* -------------------------------------------------------------------------- */

describe('id3-tag-reader', () => {
  it('reads an ID3v2.3 tag with ISO-8859-1 text frames', async () => {
    const { r, parsed } = await table(BASIC_23);
    expect(parsed.headers).toEqual(['Field', 'Value']);
    const map = asMap(parsed.rows);
    expect(map.Title).toBe('Jóga');
    expect(map.Artist).toBe('Björk');
    expect(map.Album).toBe('Homogenic');
    expect(map.Year).toBe('1997');
    expect(map.Track).toBe('3/10');
    expect(map.Genre).toBe('Electronic');
    expect(map['Tag version']).toBe('ID3v2.3.0');
    expect(r.stats?.version).toBe('ID3v2.3.0');
  });

  it('reports the tag size and frame count', async () => {
    const { parsed } = await table(BASIC_23);
    const map = asMap(parsed.rows);
    expect(map.Frames).toBe('6');
    expect(map['Tag size']).toMatch(/^\d[\d,]* bytes$/);
  });

  it('reads syncsafe frame sizes in ID3v2.4', async () => {
    const longTitle = 'A'.repeat(200);
    const bytes = tagBytes([textFrame('TIT2', longTitle, 0, 4)], 4);
    const { r, parsed } = await table(bytes);
    const map = asMap(parsed.rows);
    expect(map.Title).toBe(longTitle);
    expect(map['Tag version']).toBe('ID3v2.4.0');
    expect(r.stats?.version).toBe('ID3v2.4.0');
  });

  it('decodes UTF-16 text with a byte order mark', async () => {
    const bytes = tagBytes([textFrame('TIT2', 'Äänimerkki', 1)]);
    const { parsed } = await table(bytes);
    expect(asMap(parsed.rows).Title).toBe('Äänimerkki');
  });

  it('decodes UTF-16BE and UTF-8 text frames', async () => {
    const be = tagBytes([textFrame('TIT2', 'Naïve', 2)]);
    expect(asMap((await table(be)).parsed.rows).Title).toBe('Naïve');
    const utf8 = tagBytes([textFrame('TIT2', '日本語のうた', 3)]);
    expect(asMap((await table(utf8)).parsed.rows).Title).toBe('日本語のうた');
  });

  it('reads comments with a language code and description', async () => {
    const data = [0, ...latinBytes('eng'), 0, ...latinBytes('Great track')];
    const bytes = tagBytes([textFrame('TIT2', 'Song'), frameBytes('COMM', data)]);
    const { parsed } = await table(bytes);
    expect(asMap(parsed.rows).Comment).toBe('Great track');
  });

  it('reports embedded artwork and extracts it on request', async () => {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const apic = [0, ...latinBytes('image/png'), 0, 3, 0, ...png];
    const bytes = tagBytes([textFrame('TIT2', 'Song'), frameBytes('APIC', apic)]);

    const plain = await table(bytes);
    expect(asMap(plain.parsed.rows).Artwork).toBe('image/png, 8 bytes');
    expect(plain.r.outputs).toHaveLength(0);
    expect(plain.r.stats?.artwork).toBe('image/png');

    const extracted = await run(bytes, { extractArtwork: true });
    expect(extracted.outputs).toHaveLength(1);
    expect(extracted.outputs[0]?.filename).toBe('cover.png');
    expect(extracted.outputs[0]?.blob.type).toBe('image/png');
    expect(extracted.outputs[0]?.blob.size).toBe(8);
  });

  it('warns when artwork extraction finds nothing', async () => {
    const r = await run(BASIC_23, { extractArtwork: true });
    expect(r.outputs).toHaveLength(0);
    expect(r.warnings?.join(' ')).toMatch(/no embedded artwork/i);
  });

  it('lists every frame in raw mode', async () => {
    const priv = [0, 1, 2, 3, 4];
    const bytes = tagBytes([textFrame('TIT2', 'Song'), frameBytes('PRIV', priv)]);
    const { parsed } = await table(bytes, { raw: true });
    expect(parsed.headers).toEqual(['Frame', 'Size', 'Value']);
    const ids = parsed.rows.map((row) => row[0]);
    expect(ids).toContain('TIT2');
    expect(ids).toContain('PRIV');
    expect(parsed.rows.find((row) => row[0] === 'TIT2')?.[2]).toBe('Song');
  });

  it('reads ID3v2.2 three character frames', async () => {
    const bytes = tagBytes(
      [
        textFrame('TT2', 'Old Song', 0, 2),
        textFrame('TP1', 'Old Artist', 0, 2),
        textFrame('TAL', 'Old Album', 0, 2),
        textFrame('TYE', '1999', 0, 2),
        textFrame('TRK', '1', 0, 2),
      ],
      2,
    );
    const { parsed } = await table(bytes);
    const map = asMap(parsed.rows);
    expect(map.Title).toBe('Old Song');
    expect(map.Artist).toBe('Old Artist');
    expect(map.Album).toBe('Old Album');
    expect(map.Year).toBe('1999');
    expect(map.Track).toBe('1');
    expect(map['Tag version']).toBe('ID3v2.2.0');
  });

  it('reverses unsynchronisation before reading frames', async () => {
    const stored: number[] = [];
    const payload = frameBytes('TIT2', [0, 0x61, 0xff, 0xe0]);
    for (let i = 0; i < payload.length; i += 1) {
      const byte = payload[i] ?? 0;
      stored.push(byte);
      if (byte === 0xff && (payload[i + 1] ?? 0) >= 0xe0) stored.push(0x00);
    }
    const bytes = [...latinBytes('ID3'), 3, 0, 0x80, ...syncsafeBytes(stored.length), ...stored];
    const { r, parsed } = await table(bytes);
    expect(asMap(parsed.rows).Title).toBe('aÿà');
    expect(r.notes?.join(' ')).toMatch(/unsynchronisation/i);
  });

  it('skips an extended header', async () => {
    const ext = [...beBytes(6), 0, 0, 0, 0, 0, 0];
    const frames = tagBytes([textFrame('TIT2', 'After Ext')]).slice(10);
    const body = [...ext, ...frames];
    const bytes = [...latinBytes('ID3'), 3, 0, 0x40, ...syncsafeBytes(body.length), ...body];
    const { r, parsed } = await table(bytes);
    expect(asMap(parsed.rows).Title).toBe('After Ext');
    expect(r.notes?.join(' ')).toMatch(/extended header/i);
  });

  it('reads an ID3v1 trailer when there is no ID3v2 tag', async () => {
    const bytes = v1Trailer({
      title: 'Old Title',
      artist: 'Old Artist',
      album: 'Old Album',
      year: '1985',
      comment: 'Ripped',
      track: 7,
      genre: 17,
    });
    const { r, parsed } = await table(bytes);
    const map = asMap(parsed.rows);
    expect(map.Title).toBe('Old Title');
    expect(map.Artist).toBe('Old Artist');
    expect(map.Album).toBe('Old Album');
    expect(map.Year).toBe('1985');
    expect(map.Track).toBe('7');
    expect(map.Comment).toBe('Ripped');
    expect(map.Genre).toBe('index 17');
    expect(map['ID3v1 trailer']).toBe('present');
    expect(r.stats?.id3v1).toBe('present');
  });

  it('lets ID3v2 win while ID3v1 fills the gaps', async () => {
    const v2 = tagBytes([textFrame('TIT2', 'Modern Title'), textFrame('TPE1', 'Modern Artist')]);
    const bytes = [...v2, ...v1Trailer({ title: 'Legacy Title', artist: 'Legacy Artist', album: 'Legacy Album' })];
    const { parsed } = await table(bytes);
    const map = asMap(parsed.rows);
    expect(map.Title).toBe('Modern Title');
    expect(map.Artist).toBe('Modern Artist');
    expect(map.Album).toBe('Legacy Album');
    expect(map['ID3v1 trailer']).toBe('present');
  });

  it('stops safely on a truncated frame', async () => {
    const body = [...latinBytes('TIT2'), ...beBytes(100), 0, 0, 1, 2, 3];
    const bytes = [...latinBytes('ID3'), 3, 0, 0, ...syncsafeBytes(body.length), ...body];
    const { r, parsed } = await table(bytes);
    expect(asMap(parsed.rows).Frames).toBe('0');
    expect(r.warnings?.join(' ')).toMatch(/no frames/i);
  });

  it('warns when the tag claims more bytes than the file holds', async () => {
    const bytes = [...latinBytes('ID3'), 3, 0, 0, ...syncsafeBytes(5000), ...latinBytes('TIT2')];
    const { r } = await table(bytes);
    expect(r.warnings?.join(' ')).toMatch(/truncated/i);
  });

  it('rejects a file with no tags at all', async () => {
    const bytes = Array.from(new Uint8Array(256).fill(0x41));
    await expect(run(bytes)).rejects.toThrow(/no id3 tag found/i);
  });

  it('rejects a missing or empty file', async () => {
    await expect(run(null)).rejects.toThrow(/choose an mp3/i);
    await expect(run([])).rejects.toThrow(/empty/i);
  });
});
