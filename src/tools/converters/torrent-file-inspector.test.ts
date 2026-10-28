import { describe, expect, it } from 'vitest';
import tool from './torrent-file-inspector.tool';
import { meta } from './torrent-file-inspector.meta';

type Result = {
  report?: { output: string; render?: string };
  notes?: string[];
  warnings?: string[];
  stats?: Record<string, string | number>;
};
type Table = { headers: string[]; rows: string[][] };

const table = (r: Result): Table => JSON.parse(r.report?.output ?? '') as Table;
const kv = (t: Table): Map<string, string> => new Map(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));

/**
 * The fixtures are built by an independent bencode encoder in Python, and every
 * expected value below was computed by Python's standard library — `hashlib`
 * for the SHA-1 info-hash and `base64.b32encode` for the magnet form — not by
 * this parser.
 *
 *   single.torrent (307 B)
 *     announce http://tracker.example.com/announce, comment "a test torrent",
 *     created by "benc 0.1", creation date 1700000000,
 *     info: name payload.bin, length 1234567, piece length 262144, 5 pieces
 *     info-hash hex    363b0ac561772410f14f3758503a63c814c31231
 *     info-hash base32 GY5QVRLBO4SBB4KPG5MFAOTDZAKMGERR
 *
 *   multi.torrent (246 B)
 *     announce udp://tracker.example.org:1337
 *     info: name bundle, piece length 1024, 2 pieces,
 *           files a.txt 500, dir/b.txt 1500, empty.txt 0
 *     info-hash hex    4381cea86b127e9f13343b6dab95bc9422a6a90c
 *     info-hash base32 IOA45KDLCJ7J6EZUHNW2XFN4SQRKNKIM
 */

/** Minimal bencode encoder, written independently of the tool's decoder. */
function benc(value: unknown): Uint8Array {
  const parts: number[] = [];
  const push = (s: string) => {
    for (const ch of s) parts.push(ch.charCodeAt(0) & 0xff);
  };
  const walk = (v: unknown): void => {
    if (typeof v === 'number') {
      push(`i${v}e`);
    } else if (typeof v === 'string') {
      push(`${v.length}:${v}`);
    } else if (v instanceof Uint8Array) {
      push(`${v.length}:`);
      for (const b of v) parts.push(b);
    } else if (Array.isArray(v)) {
      push('l');
      for (const item of v) walk(item);
      push('e');
    } else if (v !== null && typeof v === 'object') {
      push('d');
      const keys = Object.keys(v as Record<string, unknown>).sort();
      for (const key of keys) {
        push(`${key.length}:${key}`);
        walk((v as Record<string, unknown>)[key]);
      }
      push('e');
    } else {
      throw new TypeError(`unsupported ${String(v)}`);
    }
  };
  walk(value);
  return new Uint8Array(parts);
}

const PIECES_5 = new Uint8Array(20 * 5).fill(0x11);
const PIECES_2 = new Uint8Array(20 * 2).fill(0x22);

const SINGLE = benc({
  announce: 'http://tracker.example.com/announce',
  comment: 'a test torrent',
  'created by': 'benc 0.1',
  'creation date': 1700000000,
  info: {
    length: 1234567,
    name: 'payload.bin',
    'piece length': 262144,
    pieces: PIECES_5,
  },
});

const MULTI = benc({
  announce: 'udp://tracker.example.org:1337',
  info: {
    files: [
      { length: 500, path: ['a.txt'] },
      { length: 1500, path: ['dir', 'b.txt'] },
      { length: 0, path: ['empty.txt'] },
    ],
    name: 'bundle',
    'piece length': 1024,
    pieces: PIECES_2,
  },
});

const toFile = (data: Uint8Array, name = 'x.torrent'): File =>
  new File([data.buffer as ArrayBuffer], name);

const run = async (data: Uint8Array, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ files: [toFile(data)], options } as never)) as unknown as Result;

describe('torrent-file-inspector meta contract', () => {
  it('registers with a unique id, on-device privacy and a short summary', () => {
    expect(meta.id).toBe('torrent-file-inspector');
    expect(meta.category).toBe('converters');
    expect(meta.privacy.processing).toBe('on-device');
    expect(meta.privacy.network).toBe('none');
    expect(meta.summary.length).toBeLessThanOrEqual(120);
  });

  it('offers five views plus a row cap', () => {
    const options = meta.options ?? [];
    expect(options.map((o) => o.key)).toEqual(['format', 'maxRows']);
    const format = options.find((o) => o.key === 'format');
    const choices = format?.type === 'select' ? format.choices.map((c) => c.value) : [];
    expect(choices).toEqual(['summary', 'files', 'pieces', 'trackers', 'findings']);
  });
});

describe('info hash matches the Python oracle', () => {
  it('computes the single-file info-hash as hex and base32', async () => {
    const m = kv(table(await run(SINGLE)));
    expect(m.get('Info hash (hex)')).toBe('363b0ac561772410f14f3758503a63c814c31231');
    expect(m.get('Info hash (base32)')).toBe('GY5QVRLBO4SBB4KPG5MFAOTDZAKMGERR');
  });

  it('computes the multi-file info-hash as hex and base32', async () => {
    const m = kv(table(await run(MULTI)));
    expect(m.get('Info hash (hex)')).toBe('4381cea86b127e9f13343b6dab95bc9422a6a90c');
    expect(m.get('Info hash (base32)')).toBe('IOA45KDLCJ7J6EZUHNW2XFN4SQRKNKIM');
  });
});

describe('metainfo fields match the oracle', () => {
  it('reads the single-file torrent metadata', async () => {
    const m = kv(table(await run(SINGLE)));
    expect(m.get('Name')).toBe('payload.bin');
    expect(m.get('Total size')).toBe('1.2 MiB');
    expect(m.get('Files')).toBe('1');
    expect(m.get('Multi-file')).toBe('no');
    expect(m.get('Piece length')).toBe('256.0 KiB');
    expect(m.get('Pieces')).toBe('5');
    expect(m.get('Pieces expected')).toBe('5');
    expect(m.get('Comment')).toBe('a test torrent');
    expect(m.get('Created by')).toBe('benc 0.1');
    expect(m.get('Creation date')).toBe('2023-11-14T22:13:20.000Z');
    expect(m.get('Announce')).toBe('http://tracker.example.com/announce');
  });

  it('sums the multi-file torrent lengths', async () => {
    const m = kv(table(await run(MULTI)));
    expect(m.get('Name')).toBe('bundle');
    expect(m.get('Total size')).toBe('2.0 KiB');
    expect(m.get('Files')).toBe('3');
    expect(m.get('Multi-file')).toBe('yes');
    expect(m.get('Pieces')).toBe('2');
    expect(m.get('Pieces expected')).toBe('2');
  });

  it('lists multi-file paths in torrent order', async () => {
    const t = table(await run(MULTI, { format: 'files' }));
    expect(t.headers).toEqual(['#', 'Path', 'Length', 'First piece', 'Last piece']);
    expect(t.rows.map((r) => r[1])).toEqual(['a.txt', 'dir/b.txt', 'empty.txt']);
  });

  it('reports a clean structure for both fixtures', async () => {
    expect(kv(table(await run(SINGLE))).get('Findings')).toBe('0 error, 0 warning, 0 note');
    // empty.txt is zero-length, which raises an informational note (not a warning).
    expect(kv(table(await run(MULTI))).get('Findings')).toBe('0 error, 0 warning, 1 note');
  });
});

describe('magnet links', () => {
  it('builds a magnet URI with the base32 hash, name and tracker', async () => {
    const t = table(await run(SINGLE, { format: 'trackers' }));
    const uri = t.rows.find((r) => r[0] === 'Magnet URI')?.[1] ?? '';
    expect(uri).toContain('xt=urn:btih:GY5QVRLBO4SBB4KPG5MFAOTDZAKMGERR');
    expect(uri).toContain('dn=payload.bin');
    expect(uri).toContain(`tr=${encodeURIComponent('http://tracker.example.com/announce')}`);
  });

  it('lists the announce URL as a tracker', async () => {
    const t = table(await run(SINGLE, { format: 'trackers' }));
    expect(t.rows.find((r) => r[0] === 'announce')?.[1]).toBe(
      'http://tracker.example.com/announce',
    );
  });
});

describe('validation findings', () => {
  it('rejects a pieces string that is not a multiple of 20', async () => {
    const bad = benc({
      announce: 'http://t.example/a',
      info: { length: 100, name: 'x', 'piece length': 64, pieces: new Uint8Array(25) },
    });
    const t = table(await run(bad, { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('pieces-not-multiple-of-20');
  });

  it('flags a piece count that disagrees with the file list', async () => {
    const bad = benc({
      announce: 'http://t.example/a',
      info: { length: 10000, name: 'x', 'piece length': 64, pieces: PIECES_2 },
    });
    const t = table(await run(bad, { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('piece-count-mismatch');
  });

  it('flags a path that escapes the download directory', async () => {
    const bad = benc({
      info: {
        name: 'evil',
        'piece length': 1024,
        pieces: PIECES_2,
        files: [{ length: 10, path: ['..', '..', 'etc', 'passwd'] }],
      },
    });
    const t = table(await run(bad, { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('path-traversal');
  });

  it('warns when a torrent has no trackers at all', async () => {
    const bad = benc({
      info: { length: 10, name: 'x', 'piece length': 1024, pieces: PIECES_2 },
    });
    const t = table(await run(bad, { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('no-trackers');
  });

  it('reports a private torrent', async () => {
    const priv = benc({
      announce: 'http://t.example/a',
      info: { length: 10, name: 'x', 'piece length': 1024, pieces: PIECES_2, private: 1 },
    });
    expect(kv(table(await run(priv))).get('Private')).toBe('yes');
    const t = table(await run(priv, { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('private-torrent');
  });

  it('flags a missing name and a missing pieces string', async () => {
    const bad = benc({ info: { length: 10, 'piece length': 1024 } });
    const t = table(await run(bad, { format: 'findings' }));
    const kinds = t.rows.map((r) => r[0]);
    expect(kinds).toContain('missing-name');
    expect(kinds).toContain('missing-pieces');
  });
});

describe('bencode decoding errors are precise', () => {
  it('rejects a non-bencode file with a byte offset', async () => {
    const junk = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    await expect(run(junk)).rejects.toThrow(/not valid bencode/u);
  });

  it('reports the offset of an unterminated integer', async () => {
    // 'i123' has no terminating 'e'; the offset names where the digits begin.
    const bad = new TextEncoder().encode('i123');
    await expect(run(bad)).rejects.toThrow(/Integer at byte 1 is unterminated/u);
  });

  it('reports trailing data after the top-level value', async () => {
    const bad = new TextEncoder().encode('i1ei2e');
    await expect(run(bad)).rejects.toThrow(/Trailing data/u);
  });

  it('rejects a torrent whose top level is not a dictionary', async () => {
    const bad = new TextEncoder().encode('li1ee');
    await expect(run(bad)).rejects.toThrow(/not a torrent metainfo/u);
  });

  it('rejects a torrent with no info dictionary', async () => {
    const bad = new TextEncoder().encode('d8:announce1:xe');
    await expect(run(bad)).rejects.toThrow(/no info dictionary/u);
  });

  it('reports a string that runs past the end of the file', async () => {
    const bad = new TextEncoder().encode('d1:a100:');
    await expect(run(bad)).rejects.toThrow(/runs past the end/u);
  });
});

describe('views and guards', () => {
  it('lists piece byte ranges', async () => {
    const t = table(await run(SINGLE, { format: 'pieces', maxRows: 3 }));
    expect(t.headers).toEqual(['Piece', 'Byte start', 'Byte end', 'Length']);
    expect(t.rows.length).toBe(3);
    expect(t.rows[0]).toEqual(['0', '0', '262144', '256.0 KiB']);
    expect(t.rows[1]?.[1]).toBe('262144');
  });

  it('clamps a negative row cap to zero rows', async () => {
    const t = table(await run(SINGLE, { format: 'files', maxRows: -2 }));
    expect(t.rows.length).toBe(0);
  });

  it('falls back to the summary for an unknown view', async () => {
    const r = await run(SINGLE, { format: 'nope' });
    expect(kv(table(r)).get('Name')).toBe('payload.bin');
    expect(r.warnings?.some((w) => w.includes('nope'))).toBe(true);
  });

  it('rejects a missing file', async () => {
    await expect(tool.run({ files: [], options: {} } as never)).rejects.toThrow(/No torrent/u);
  });

  it('rejects an empty file', async () => {
    await expect(run(new Uint8Array(0))).rejects.toThrow(/empty/u);
  });

  it('rejects a file over the 32 MB cap', async () => {
    const huge = new File([new Uint8Array(33 * 1024 * 1024).buffer as ArrayBuffer], 'huge.torrent');
    await expect(tool.run({ files: [huge], options: {} } as never)).rejects.toThrow(/32 MB/u);
  });
});