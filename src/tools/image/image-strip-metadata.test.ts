import { describe, expect, it, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import tool, { sniffFormat, stripImage, type StripOptions } from './image-strip-metadata.tool';

/* -------------------------------------------------------------------------- */
/*  Byte helpers                                                              */
/* -------------------------------------------------------------------------- */

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function containsBytes(hay: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let k = 0; k < needle.length; k++) {
      if (hay[i + k] !== needle[k]) continue outer;
    }
    return true;
  }
  return false;
}

function text(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'latin1'));
}

const OPT: StripOptions = { keepColorProfile: true, removeComments: true };

/* -------------------------------------------------------------------------- */
/*  JPEG fixtures                                                             */
/* -------------------------------------------------------------------------- */

function jpegSegment(marker: number, payload: Uint8Array): Uint8Array {
  const len = payload.length + 2;
  const out = new Uint8Array(4 + payload.length);
  out[0] = 0xff;
  out[1] = marker;
  out[2] = (len >> 8) & 0xff;
  out[3] = len & 0xff;
  out.set(payload, 4);
  return out;
}

function exifPayload(orientation = 6): Uint8Array {
  const tiff = Buffer.alloc(8);
  tiff.write('II', 0, 'latin1'); // little-endian
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  const ifd = Buffer.alloc(2 + 12 + 4);
  ifd.writeUInt16LE(1, 0); // one entry
  ifd.writeUInt16LE(0x0112, 2); // Orientation
  ifd.writeUInt16LE(3, 4); // SHORT
  ifd.writeUInt32LE(1, 6); // count
  ifd.writeUInt16LE(orientation, 10);
  return concat([text('Exif\0\0'), new Uint8Array(tiff), new Uint8Array(ifd)]);
}

const XMP_PAYLOAD = concat([text('http://ns.adobe.com/xap/1.0/\0'), text('<x:xmpmeta/>')]);
const ICC_PAYLOAD = concat([text('ICC_PROFILE\0'), text('fake-icc-profile')]);
const COM_PAYLOAD = text('Created by TestCam 1.0');
const SCAN = Uint8Array.of(0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd0, 0x78, 0x9a);

/** SOI + APP0 + EXIF + XMP + COM + ICC + APP13 + Adobe(APP14) + SOS + scan + EOI. */
function dirtyJpeg(orientation = 6): Uint8Array {
  return concat([
    Uint8Array.of(0xff, 0xd8),
    jpegSegment(0xe0, text('JFIF\0\x01\x02')),
    jpegSegment(0xe1, exifPayload(orientation)),
    jpegSegment(0xe1, XMP_PAYLOAD),
    jpegSegment(0xfe, COM_PAYLOAD),
    jpegSegment(0xe2, ICC_PAYLOAD),
    jpegSegment(0xed, text('Photoshop 3.0')),
    jpegSegment(0xee, text('Adobe\0\x64\x00\x00\x00\x00\x00')),
    jpegSegment(0xda, Uint8Array.of(0x01, 0x02)),
    SCAN,
    Uint8Array.of(0xff, 0xd9),
  ]);
}

/* -------------------------------------------------------------------------- */
/*  PNG fixtures                                                              */
/* -------------------------------------------------------------------------- */

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    let c = (crc ^ data[i]!) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const body = concat([text(type), data]);
  const out = Buffer.alloc(4 + body.length + 4);
  out.writeUInt32BE(data.length, 0);
  Buffer.from(body).copy(out, 4);
  out.writeUInt32BE(crc32(body), 4 + body.length);
  return new Uint8Array(out);
}

function pngChunkTypes(bytes: Uint8Array): string[] {
  const types: string[] = [];
  let o = 8;
  while (o + 12 <= bytes.length) {
    const len =
      ((bytes[o]! << 24) | (bytes[o + 1]! << 16) | (bytes[o + 2]! << 8) | bytes[o + 3]!) >>> 0;
    types.push(String.fromCharCode(bytes[o + 4]!, bytes[o + 5]!, bytes[o + 6]!, bytes[o + 7]!));
    o += 12 + len;
  }
  return types;
}

const PNG_SIG = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const IDAT_DATA = Uint8Array.of(0x78, 0x9c, 0x01, 0x02, 0x03, 0x04);

function dirtyPng(includeIccp = false): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const parts = [
    PNG_SIG,
    pngChunk('IHDR', new Uint8Array(ihdr)),
    pngChunk('tEXt', text('Author\0TestCam')),
    pngChunk('zTXt', concat([text('Comment\0'), Uint8Array.of(0, 0x78, 0x9c, 0x00)])),
    pngChunk('iTXt', concat([text('XML:com.adobe.xmp\0\0\0\0\0'), text('<x/>')])),
    pngChunk('eXIf', exifPayload()),
    pngChunk('tIME', Uint8Array.of(126, 1, 2, 3, 4, 5, 6)),
  ];
  if (includeIccp) parts.push(pngChunk('iCCP', concat([text('ICC\0\0'), text('fake-icc')])));
  parts.push(
    pngChunk('pHYs', Uint8Array.of(0, 0, 0x0b, 0x13, 0, 0, 0x0b, 0x13, 1)),
    pngChunk('IDAT', IDAT_DATA),
    pngChunk('IEND', new Uint8Array(0)),
  );
  return concat(parts);
}

/* -------------------------------------------------------------------------- */
/*  WebP fixtures                                                             */
/* -------------------------------------------------------------------------- */

function riffChunk(fourcc: string, data: Uint8Array): Uint8Array {
  const header = Buffer.alloc(8);
  header.write(fourcc, 0, 'latin1');
  header.writeUInt32LE(data.length, 4);
  const pad = data.length & 1 ? Uint8Array.of(0) : new Uint8Array(0);
  return concat([new Uint8Array(header), data, pad]);
}

const VP8L_DATA = Uint8Array.of(0x2f, 0x01, 0x02, 0x03, 0x04);

function dirtyWebp(
  includeIccp = false,
  includeIccpFlag = false,
  includeIccpChunk = false,
): Uint8Array {
  // VP8X flags: ICCP 0x20, EXIF 0x08, XMP 0x04.
  let flags = 0x0c;
  if (includeIccp || includeIccpFlag) flags |= 0x20;
  const vp8x = Uint8Array.of(flags, 0, 0, 0, 0x01, 0, 0, 0x01, 0, 0);
  const body = [riffChunk('VP8X', vp8x), riffChunk('VP8L', VP8L_DATA)];
  if (includeIccp || includeIccpChunk) body.push(riffChunk('ICCP', text('fake-icc')));
  body.push(riffChunk('EXIF', exifPayload()), riffChunk('XMP ', text('<x/>')));
  const payload = concat(body);
  const out = Buffer.alloc(12 + payload.length);
  out.write('RIFF', 0, 'latin1');
  out.writeUInt32LE(4 + payload.length, 4);
  out.write('WEBP', 8, 'latin1');
  Buffer.from(payload).copy(out, 12);
  return new Uint8Array(out);
}

function webpChunks(bytes: Uint8Array): { fourcc: string; data: Uint8Array }[] {
  const out: { fourcc: string; data: Uint8Array }[] = [];
  let o = 12;
  while (o + 8 <= bytes.length) {
    const fourcc = String.fromCharCode(bytes[o]!, bytes[o + 1]!, bytes[o + 2]!, bytes[o + 3]!);
    const size =
      (bytes[o + 4]! | (bytes[o + 5]! << 8) | (bytes[o + 6]! << 16) | (bytes[o + 7]! << 24)) >>> 0;
    out.push({ fourcc, data: bytes.subarray(o + 8, o + 8 + size) });
    o += 8 + size + (size & 1);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('sniffFormat', () => {
  it('recognises JPEG, PNG and WebP from magic bytes', () => {
    expect(sniffFormat(Uint8Array.of(0xff, 0xd8, 0xff, 0xd9))).toBe('jpeg');
    expect(sniffFormat(dirtyPng())).toBe('png');
    expect(sniffFormat(dirtyWebp())).toBe('webp');
  });
  it('returns null for unknown bytes', () => {
    expect(sniffFormat(text('hello world'))).toBeNull();
    expect(sniffFormat(new Uint8Array(0))).toBeNull();
  });
});

describe('stripImage (JPEG)', () => {
  it('removes EXIF, XMP, COM and APP13 while keeping the scan data', () => {
    const src = dirtyJpeg();
    const { bytes, removed } = stripImage(src, 'jpeg', OPT);

    expect(removed.map((r) => r.label)).toEqual([
      'APP1 EXIF',
      'APP1 XMP',
      'Comment (COM)',
      'APP13 Photoshop/IPTC',
    ]);
    expect(bytes.length).toBe(src.length - removed.reduce((n, r) => n + r.size, 0));

    // SOI/EOI framing intact, scan bytes and SOS marker untouched.
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    expect(bytes.slice(-2)).toEqual(Uint8Array.of(0xff, 0xd9));
    expect(containsBytes(bytes, SCAN)).toBe(true);
    expect(containsBytes(bytes, Uint8Array.of(0xff, 0xda))).toBe(true);

    // Metadata gone, non-metadata segments kept.
    expect(containsBytes(bytes, text('Exif\0\0'))).toBe(false);
    expect(containsBytes(bytes, XMP_PAYLOAD)).toBe(false);
    expect(containsBytes(bytes, COM_PAYLOAD)).toBe(false);
    expect(containsBytes(bytes, text('JFIF\0\x01\x02'))).toBe(true);
    expect(containsBytes(bytes, text('Adobe\0'))).toBe(true);
    // ICC profile (APP2) is kept by default.
    expect(containsBytes(bytes, ICC_PAYLOAD)).toBe(true);
  });

  it('warns when a non-upright EXIF orientation tag is dropped', () => {
    const { warnings } = stripImage(dirtyJpeg(6), 'jpeg', OPT);
    expect(warnings.join(' ')).toMatch(/orientation 6/i);
  });

  it('does not warn for a normal orientation', () => {
    const { warnings } = stripImage(dirtyJpeg(1), 'jpeg', OPT);
    expect(warnings.join(' ')).not.toMatch(/orientation/i);
  });

  it('removes the ICC profile when keepColorProfile is false', () => {
    const { bytes, removed, warnings } = stripImage(dirtyJpeg(), 'jpeg', {
      keepColorProfile: false,
      removeComments: true,
    });
    expect(removed.map((r) => r.label)).toContain('APP2 ICC colour profile');
    expect(containsBytes(bytes, ICC_PAYLOAD)).toBe(false);
    expect(warnings.join(' ')).toMatch(/colour profile was removed/i);
  });

  it('keeps COM segments when removeComments is false', () => {
    const { bytes, removed } = stripImage(dirtyJpeg(), 'jpeg', {
      keepColorProfile: true,
      removeComments: false,
    });
    expect(removed.map((r) => r.label)).not.toContain('Comment (COM)');
    expect(containsBytes(bytes, COM_PAYLOAD)).toBe(true);
  });

  it('is a no-op (byte identical) for a JPEG without metadata', () => {
    const clean = concat([
      Uint8Array.of(0xff, 0xd8),
      jpegSegment(0xe0, text('JFIF\0')),
      jpegSegment(0xda, Uint8Array.of(0x01, 0x02)),
      SCAN,
      Uint8Array.of(0xff, 0xd9),
    ]);
    const { bytes, removed } = stripImage(clean, 'jpeg', OPT);
    expect(removed).toEqual([]);
    expect(Array.from(bytes)).toEqual(Array.from(clean));
  });

  it('throws on a truncated JPEG', () => {
    expect(() => stripImage(Uint8Array.of(0xff, 0xd8, 0xff, 0xe1, 0x00), 'jpeg', OPT)).toThrow(
      /truncated or corrupted/i,
    );
    // SOI + APP1 whose declared length runs past EOF.
    const bad = concat([Uint8Array.of(0xff, 0xd8), Uint8Array.of(0xff, 0xe1, 0x10, 0x00, 0x00)]);
    expect(() => stripImage(bad, 'jpeg', OPT)).toThrow(/truncated or corrupted/i);
  });

  it('throws when EOI is missing', () => {
    const noEoi = dirtyJpeg().slice(0, -2);
    expect(() => stripImage(noEoi, 'jpeg', OPT)).toThrow(/truncated or corrupted/i);
  });
});

describe('stripImage (PNG)', () => {
  it('removes text/EXIF/time chunks and keeps critical chunks and pixel data', () => {
    const src = dirtyPng();
    const { bytes, removed } = stripImage(src, 'png', OPT);

    expect(removed.map((r) => r.label)).toEqual([
      'Text (tEXt)',
      'Compressed text (zTXt)',
      'International text (iTXt)',
      'EXIF (eXIf)',
      'Modification time (tIME)',
    ]);
    expect(pngChunkTypes(bytes)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);
    expect(containsBytes(bytes, IDAT_DATA)).toBe(true);
    expect(containsBytes(bytes, text('Author\0TestCam'))).toBe(false);
    expect(bytes.slice(0, 8)).toEqual(PNG_SIG);
    expect(bytes.length).toBe(src.length - removed.reduce((n, r) => n + r.size, 0));
  });

  it('keeps the iCCP profile by default and removes it when asked', () => {
    const kept = stripImage(dirtyPng(true), 'png', OPT);
    expect(kept.removed.map((r) => r.label)).not.toContain('ICC colour profile (iCCP)');
    expect(pngChunkTypes(kept.bytes)).toContain('iCCP');

    const stripped = stripImage(dirtyPng(true), 'png', {
      keepColorProfile: false,
      removeComments: true,
    });
    expect(stripped.removed.map((r) => r.label)).toContain('ICC colour profile (iCCP)');
    expect(pngChunkTypes(stripped.bytes)).not.toContain('iCCP');
    expect(stripped.warnings.join(' ')).toMatch(/colour profile was removed/i);
  });

  it('is byte identical for a clean PNG', () => {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(1, 0);
    ihdr.writeUInt32BE(1, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    const clean = concat([
      PNG_SIG,
      pngChunk('IHDR', new Uint8Array(ihdr)),
      pngChunk('IDAT', IDAT_DATA),
      pngChunk('IEND', new Uint8Array(0)),
    ]);
    const { bytes, removed } = stripImage(clean, 'png', OPT);
    expect(removed).toEqual([]);
    expect(Array.from(bytes)).toEqual(Array.from(clean));
  });

  it('throws on a truncated PNG', () => {
    const truncated = concat([PNG_SIG, Uint8Array.of(0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52)]);
    expect(() => stripImage(truncated, 'png', OPT)).toThrow(/truncated or corrupted/i);
    expect(() => stripImage(PNG_SIG, 'png', OPT)).toThrow(/truncated or corrupted/i);
  });

  it('throws when the first chunk is not IHDR', async () => {
    const bad = concat([PNG_SIG, pngChunk('IDAT', IDAT_DATA)]);
    try {
      stripImage(bad, 'png', OPT);
      expect.unreachable('expected stripImage to throw');
    } catch (error) {
      expect((error as ToolError).message).toMatch(/malformed/i);
      expect((error as ToolError).hint).toMatch(/IHDR/i);
    }
  });
});

describe('stripImage (WebP)', () => {
  it('removes EXIF and XMP chunks and clears the VP8X flags', () => {
    const src = dirtyWebp();
    const { bytes, removed } = stripImage(src, 'webp', OPT);

    expect(removed.map((r) => r.label)).toEqual(['EXIF chunk', 'XMP chunk']);
    const chunks = webpChunks(bytes);
    expect(chunks.map((c) => c.fourcc)).toEqual(['VP8X', 'VP8L']);
    expect(chunks[0]!.data[0]).toBe(0); // EXIF (0x08) and XMP (0x04) bits cleared
    expect(chunks[1]!.data).toEqual(VP8L_DATA);

    // RIFF size field matches the rebuilt file.
    const declared = (bytes[4]! | (bytes[5]! << 8) | (bytes[6]! << 16) | (bytes[7]! << 24)) >>> 0;
    expect(declared).toBe(bytes.length - 8);
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WEBP');
    expect(bytes.length).toBe(src.length - removed.reduce((n, r) => n + r.size, 0));
  });

  it('keeps ICCP by default and removes it when asked, clearing the flag', () => {
    const kept = stripImage(dirtyWebp(true), 'webp', OPT);
    expect(webpChunks(kept.bytes).map((c) => c.fourcc)).toContain('ICCP');
    expect(webpChunks(kept.bytes)[0]!.data[0]! & 0x20).toBe(0x20);

    const stripped = stripImage(dirtyWebp(true), 'webp', {
      keepColorProfile: false,
      removeComments: true,
    });
    const chunks = webpChunks(stripped.bytes);
    expect(chunks.map((c) => c.fourcc)).not.toContain('ICCP');
    expect(chunks[0]!.data[0]! & 0x20).toBe(0);
    expect(stripped.warnings.join(' ')).toMatch(/colour profile was removed/i);
  });

  it('throws on a truncated WebP', () => {
    const src = dirtyWebp();
    expect(() => stripImage(src.slice(0, src.length - 4), 'webp', OPT)).toThrow(
      /truncated or corrupted/i,
    );
    expect(() => stripImage(text('RIFFxxxxWEBP'), 'webp', OPT)).toThrow(/truncated or corrupted/i);
  });

  it('throws when there is no image data chunk', () => {
    const payload = concat([riffChunk('EXIF', text('Exif\0\0'))]);
    const out = Buffer.alloc(12 + payload.length);
    out.write('RIFF', 0, 'latin1');
    out.writeUInt32LE(4 + payload.length, 4);
    out.write('WEBP', 8, 'latin1');
    Buffer.from(payload).copy(out, 12);
    try {
      stripImage(new Uint8Array(out), 'webp', OPT);
      expect.unreachable('expected stripImage to throw');
    } catch (error) {
      expect((error as ToolError).message).toMatch(/not a valid WebP/i);
      expect((error as ToolError).hint).toMatch(/no image data chunk/i);
    }
  });
});

describe('image-strip-metadata run', () => {
  function makeFile(name: string, bytes: Uint8Array, mime = 'image/jpeg'): File {
    return new File([new Uint8Array(bytes)], name, { type: mime });
  }

  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects a non-image selection', async () => {
    const file = new File(['note'], 'note.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('rejects an empty file', async () => {
    const file = makeFile('empty.jpg', new Uint8Array(0));
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/is empty/i);
  });

  it('rejects an unsupported image format with a clear hint', async () => {
    const gif = makeFile('anim.gif', text('GIF89a\x01\x00\x01\x00'), 'image/gif');
    try {
      await tool.run({ files: [gif], options: {} });
      expect.unreachable('expected run to reject');
    } catch (error) {
      expect((error as ToolError).message).toMatch(/not a supported image/i);
      expect((error as ToolError).hint).toMatch(/JPEG, PNG and WebP/i);
    }
  });

  it('throws a ToolError for a truncated file', async () => {
    const file = makeFile('broken.jpg', Uint8Array.of(0xff, 0xd8, 0xff, 0xe1, 0x00));
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(
      /truncated or corrupted/i,
    );
  });

  it('strips metadata, reports what was removed and names the output', async () => {
    const file = makeFile('photo.jpg', dirtyJpeg());
    const result = await tool.run({ files: [file], options: {} });

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('photo-clean.jpg');
    expect(result.outputs[0]!.blob.type).toBe('image/jpeg');
    expect(result.stats?.removed).toBe(4);
    expect(result.notes?.join(' ')).toMatch(/removed 4 metadata segments/i);

    const table = JSON.parse(result.report!.output) as { headers: string[]; rows: string[][] };
    expect(table.headers).toEqual(['File', 'Removed', 'Bytes']);
    expect(table.rows.map((r) => r[1])).toContain('APP1 EXIF');
    expect(table.rows.every((r) => r[0] === 'photo.jpg')).toBe(true);

    const outBytes = new Uint8Array(await result.outputs[0]!.blob.arrayBuffer());
    expect(containsBytes(outBytes, text('Exif\0\0'))).toBe(false);
    expect(containsBytes(outBytes, SCAN)).toBe(true);
  });

  it('notes when a file is already clean and still returns a copy', async () => {
    const clean = concat([
      Uint8Array.of(0xff, 0xd8),
      jpegSegment(0xda, Uint8Array.of(0x01, 0x02)),
      SCAN,
      Uint8Array.of(0xff, 0xd9),
    ]);
    const result = await tool.run({ files: [makeFile('clean.jpg', clean)], options: {} });
    expect(result.stats?.removed).toBe(0);
    expect(result.notes?.join(' ')).toMatch(/no removable metadata found/i);
    expect(result.outputs).toHaveLength(1);
    const table = JSON.parse(result.report!.output) as { rows: string[][] };
    expect(table.rows[0]![1]).toMatch(/No removable metadata/i);
  });

  it('processes a mixed batch and reports progress', async () => {
    const onProgress = vi.fn();
    const result = await tool.run({
      files: [
        makeFile('a.jpg', dirtyJpeg()),
        makeFile('b.png', dirtyPng(), 'image/png'),
        makeFile('c.webp', dirtyWebp(), 'image/webp'),
      ],
      options: {},
      onProgress,
    });

    expect(result.outputs.map((o) => o.filename)).toEqual([
      'a-clean.jpg',
      'b-clean.png',
      'c-clean.webp',
    ]);
    expect(result.outputs.map((o) => o.blob.type)).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    expect(result.stats?.files).toBe(3);
    expect(result.stats?.removed).toBe(11);
    expect(onProgress).toHaveBeenCalledWith(1, 'Done');
  });

  it('cancels when the signal is already aborted', async () => {
    await expect(
      tool.run({
        files: [makeFile('a.jpg', dirtyJpeg())],
        options: {},
        signal: AbortSignal.abort(),
      }),
    ).rejects.toThrow(/cancelled/i);
  });
});
