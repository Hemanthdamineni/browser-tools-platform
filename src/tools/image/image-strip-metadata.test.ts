import { describe, expect, it } from 'vitest';
import type { FileRunResult } from '@/lib/types';
import tool, {
  MAX_FILE_BYTES,
  buildOrientationJpegSegment,
  crc32,
  detectFormat,
  readOrientation,
  stripJpeg,
  stripPng,
  stripWebp,
  toStripOptions,
} from './image-strip-metadata.tool';
import type { StripOptions } from './image-strip-metadata.tool';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_OPTS: StripOptions = {
  stripExif: true,
  stripGps: true,
  stripXmp: true,
  stripIptc: true,
  stripText: true,
  stripIcc: false,
  keepOrientation: true,
};

const opts = (over: Partial<StripOptions> = {}): StripOptions => ({ ...DEFAULT_OPTS, ...over });

function u8(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function ascii(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function expectBytes(actual: Uint8Array, expected: Uint8Array): void {
  expect(actual.length).toBe(expected.length);
  expect(Array.from(actual)).toEqual(Array.from(expected));
}

function sliceBytes(bytes: Uint8Array): Uint8Array {
  return bytes.slice();
}

function writeBe32(b: Uint8Array, o: number, value: number): void {
  b[o] = (value >>> 24) & 0xff;
  b[o + 1] = (value >>> 16) & 0xff;
  b[o + 2] = (value >>> 8) & 0xff;
  b[o + 3] = value & 0xff;
}

function writeLe32(b: Uint8Array, o: number, value: number): void {
  b[o] = value & 0xff;
  b[o + 1] = (value >>> 8) & 0xff;
  b[o + 2] = (value >>> 16) & 0xff;
  b[o + 3] = (value >>> 24) & 0xff;
}

function readLe32(b: Uint8Array, o: number): number {
  return ((b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0);
}

/** Independent CRC-32 implementation (bitwise, table-free) for fixtures + checks. */
function refCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc ^ byte) >>> 0;
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? ((crc >>> 1) ^ 0xedb88320) >>> 0 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/* ---------------------------------- JPEG ---------------------------------- */

/** A raw JPEG marker segment: FF, marker, 2-byte length, payload. */
function seg(marker: number, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + payload.length);
  out[0] = 0xff;
  out[1] = marker;
  const len = 2 + payload.length;
  out[2] = (len >> 8) & 0xff;
  out[3] = len & 0xff;
  out.set(payload, 4);
  return out;
}

interface IfdEntry {
  tag: number;
  type: number;
  count: number;
  value: number;
}

/** Little-endian TIFF block with a one-entry IFD0, optionally Exif-signed. */
function exifPayload(entries: IfdEntry[], withSignature = true): Uint8Array {
  const tiff = new Uint8Array(8 + 2 + entries.length * 12 + 4);
  let p = 0;
  const u16 = (v: number): void => {
    tiff[p++] = v & 0xff;
    tiff[p++] = (v >> 8) & 0xff;
  };
  const u32 = (v: number): void => {
    u16(v & 0xffff);
    u16((v >>> 16) & 0xffff);
  };
  tiff[p++] = 0x49;
  tiff[p++] = 0x49; // "II" → little-endian
  u16(42); // TIFF magic
  u32(8); // IFD0 offset
  u16(entries.length);
  for (const e of entries) {
    u16(e.tag);
    u16(e.type);
    u32(e.count);
    u32(e.value); // inline values only (≤ 4 bytes)
  }
  u32(0); // no next IFD
  return withSignature ? concat(ascii('Exif\0\0'), tiff) : tiff;
}

const ORIENTATION_6: IfdEntry = { tag: 0x0112, type: 3, count: 1, value: 6 };
const GPS_POINTER: IfdEntry = { tag: 0x8825, type: 4, count: 1, value: 0x64 };

const EXIF_ORIENT_6 = seg(0xe1, exifPayload([ORIENTATION_6]));
const EXIF_ORIENT_1 = seg(0xe1, exifPayload([{ tag: 0x0112, type: 3, count: 1, value: 1 }]));
const EXIF_GPS = seg(0xe1, exifPayload([GPS_POINTER]));
const EXIF_PLAIN = seg(0xe1, exifPayload([{ tag: 0x010f, type: 2, count: 4, value: 0x616263 }]));
const XMP = seg(0xe1, concat(ascii('http://ns.adobe.com/xap/1.0/'), u8(0), ascii('<x:xmpmeta/>')));
const XMP_EXTENDED = seg(
  0xe1,
  concat(ascii('http://ns.adobe.com/xmp/extension/'), u8(0), ascii('junk')),
);
const IPTC = seg(0xed, concat(ascii('Photoshop 3.0'), u8(0), u8(0x38, 0x42, 0x49, 0x4d)));
const OTHER_APP13 = seg(0xed, concat(ascii('NotPhotoshop'), new Uint8Array(8)));
const ICC = seg(0xe2, concat(ascii('ICC_PROFILE'), u8(0), u8(1, 1), new Uint8Array(64)));
const COM = seg(0xfe, ascii('shot with a secret camera'));
const JFIF = seg(0xe0, concat(ascii('JFIF\0'), u8(1, 1, 0, 0, 1, 0, 1, 0, 0)));

/** Entropy-coded scan data containing bytes that look like markers. */
const ENTROPY = u8(0x12, 0x34, 0xff, 0x00, 0xab, 0xff, 0xe1, 0x00, 0x08, 0x99);
/** SOS header (scan start) — everything after it must be copied verbatim. */
const SOS = u8(0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00);
const EOI = u8(0xff, 0xd9);

function jpegWith(...segments: Uint8Array[]): Uint8Array {
  return concat(u8(0xff, 0xd8), ...segments, SOS, ENTROPY, EOI);
}

/* ----------------------------------- PNG ---------------------------------- */

const PNG_SIG = u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const IHDR_DATA = u8(0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0);
const IDAT_DATA = u8(0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01);
const PHYS_DATA = u8(0, 0, 0x0b, 0x13, 0, 0, 0x0b, 0x13, 1);

function pngChunk(type: string, data: Uint8Array, crcOverride?: number): Uint8Array {
  const body = concat(ascii(type), data);
  // 4-byte length + 4-byte type + data + 4-byte CRC
  const out = new Uint8Array(8 + body.length);
  writeBe32(out, 0, data.length);
  out.set(body, 4);
  writeBe32(out, 4 + body.length, crcOverride ?? refCrc32(body));
  return out;
}

function pngWith(...extra: Uint8Array[]): Uint8Array {
  return concat(
    PNG_SIG,
    pngChunk('IHDR', IHDR_DATA),
    ...extra,
    pngChunk('IDAT', IDAT_DATA),
    pngChunk('IEND', new Uint8Array(0)),
  );
}

interface PngChunkView {
  type: string;
  data: Uint8Array;
  raw: Uint8Array;
  crcOk: boolean;
}

function pngChunksOf(bytes: Uint8Array): PngChunkView[] {
  const chunks: PngChunkView[] = [];
  let o = 8;
  while (o + 8 <= bytes.length) {
    const len = ((bytes[o]! << 24) | (bytes[o + 1]! << 16) | (bytes[o + 2]! << 8) | bytes[o + 3]!) >>> 0;
    const type = String.fromCharCode(bytes[o + 4]!, bytes[o + 5]!, bytes[o + 6]!, bytes[o + 7]!);
    const dataStart = o + 8;
    const dataEnd = dataStart + len;
    const chunkEnd = dataEnd + 4;
    const body = bytes.subarray(o + 4, dataEnd);
    const stored =
      ((bytes[dataEnd]! << 24) |
        (bytes[dataEnd + 1]! << 16) |
        (bytes[dataEnd + 2]! << 8) |
        bytes[dataEnd + 3]!) >>>
      0;
    chunks.push({
      type,
      data: bytes.subarray(dataStart, dataEnd),
      raw: bytes.subarray(o, chunkEnd),
      crcOk: stored === refCrc32(body),
    });
    o = chunkEnd;
    if (type === 'IEND') break;
  }
  return chunks;
}

const PNG_TEXT = pngChunk('tEXt', concat(ascii('Author\0'), ascii('Claude')));
const PNG_EXIF = pngChunk('eXIf', exifPayload([ORIENTATION_6], false));
const PNG_EXIF_SIGNED = pngChunk('eXIf', exifPayload([ORIENTATION_6, GPS_POINTER], true));
const PNG_XMP = pngChunk(
  'iTXt',
  concat(ascii('XML:com.adobe.xmp\0'), u8(0, 0), ascii('\0'), ascii('\0'), ascii('<x:xmpmeta/>')),
);
const PNG_COMMENT = pngChunk('iTXt', concat(ascii('Comment\0'), u8(0, 0), ascii('\0'), ascii('\0'), ascii('hi')));
const PNG_ICCP = pngChunk('iCCP', concat(ascii('ICC profile\0'), u8(0), new Uint8Array(16)));
const PNG_PHYS = pngChunk('pHYs', PHYS_DATA);
const PNG_PRIVATE = pngChunk('abcd', u8(1, 2, 3, 4, 5));

/* ---------------------------------- WebP ---------------------------------- */

function webpChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + data.length + (data.length & 1));
  out.set(ascii(type), 0);
  writeLe32(out, 4, data.length);
  out.set(data, 8);
  return out;
}

function webp(...chunks: Uint8Array[]): Uint8Array {
  const body = concat(...chunks);
  const out = new Uint8Array(12 + body.length);
  out.set(ascii('RIFF'), 0);
  writeLe32(out, 4, 4 + body.length); // "WEBP" + body
  out.set(ascii('WEBP'), 8);
  out.set(body, 12);
  return out;
}

const VP8X_DATA = u8(0x20 | 0x08 | 0x04 | 0x10, 0, 0, 0, 0, 0, 0, 0, 0, 0);
const VP8L_DATA = u8(0x2f, 0x01, 0x02, 0x03, 0x04);
const ALPH_DATA = u8(0x00, 0x11, 0x22);

const WEBP_META = webp(
  webpChunk('VP8X', VP8X_DATA),
  webpChunk('VP8L', VP8L_DATA),
  webpChunk('ALPH', ALPH_DATA),
  webpChunk('EXIF', exifPayload([ORIENTATION_6])),
  webpChunk('XMP ', ascii('<x:xmpmeta/>')),
  webpChunk('ICCP', concat(u8(0, 0, 0, 0), ascii('profile'))),
);

interface WebpChunkView {
  type: string;
  data: Uint8Array;
}

function webpChunksOf(bytes: Uint8Array): WebpChunkView[] {
  const chunks: WebpChunkView[] = [];
  const end = 8 + readLe32(bytes, 4);
  let o = 12;
  while (o + 8 <= end) {
    const type = String.fromCharCode(bytes[o]!, bytes[o + 1]!, bytes[o + 2]!, bytes[o + 3]!);
    const size = readLe32(bytes, o + 4);
    chunks.push({ type, data: bytes.subarray(o + 8, o + 8 + size) });
    o += 8 + size + (size & 1);
  }
  return chunks;
}

/* -------------------------------------------------------------------------- */
/*  CRC + format detection                                                    */
/* -------------------------------------------------------------------------- */

describe('crc32', () => {
  it('matches the well-known IEND chunk checksum', () => {
    expect(crc32(ascii('IEND'))).toBe(0xae426082);
  });
  it('agrees with the reference implementation on arbitrary data', () => {
    const data = concat(ascii('tEXt'), u8(0, 1, 2, 250, 255));
    expect(crc32(data)).toBe(refCrc32(data));
  });
});

describe('detectFormat', () => {
  it('classifies the three supported containers from magic bytes', () => {
    expect(detectFormat(jpegWith())).toBe('jpeg');
    expect(detectFormat(pngWith())).toBe('png');
    expect(detectFormat(WEBP_META)).toBe('webp');
  });
  it('returns null for anything else', () => {
    expect(detectFormat(ascii('GIF89a....'))).toBeNull();
    expect(detectFormat(new Uint8Array(0))).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/*  JPEG                                                                      */
/* -------------------------------------------------------------------------- */

describe('stripJpeg', () => {
  it('removes the APP1 EXIF segment and copies every other byte verbatim', () => {
    const input = jpegWith(JFIF, EXIF_ORIENT_6);
    const result = stripJpeg(input, opts({ keepOrientation: false }));

    expectBytes(result.bytes, jpegWith(JFIF));
    expect(result.unchanged).toBe(false);
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0]).toMatchObject({ category: 'exif', label: 'APP1 EXIF' });
    expect(result.removed[0]!.bytes).toBe(EXIF_ORIENT_6.length);
  });

  it('never parses bytes after the start of scan', () => {
    // ENTROPY contains FF 00 stuffing and a fake FF E1 00 08 segment header: a
    // walker that scanned past SOS would corrupt or mis-strip them.
    const input = jpegWith(JFIF, EXIF_ORIENT_6);
    const out = stripJpeg(input, opts({ keepOrientation: false })).bytes;
    expectBytes(out.subarray(out.length - (SOS.length + ENTROPY.length + EOI.length)), concat(SOS, ENTROPY, EOI));
  });

  it('returns an identical copy for a JPEG with no metadata', () => {
    const input = jpegWith(JFIF);
    const result = stripJpeg(input, opts());
    expectBytes(result.bytes, input);
    expect(result.unchanged).toBe(true);
    expect(result.removed).toEqual([]);
  });

  it('re-adds a minimal orientation-only EXIF block when asked to keep orientation', () => {
    const input = jpegWith(JFIF, EXIF_ORIENT_6);
    const result = stripJpeg(input, opts());

    expectBytes(result.bytes, concat(u8(0xff, 0xd8), JFIF, buildOrientationJpegSegment(6), SOS, ENTROPY, EOI));
    expect(result.notes.join(' ')).toMatch(/Orientation \(6\)/);

    // Round-trip: the synthetic segment is a readable APP1 carrying only Orientation.
    const synthetic = result.bytes.subarray(2 + JFIF.length, 2 + JFIF.length + 36);
    expect(synthetic.length).toBe(36); // marker + length + "Exif\0\0" + 32-byte TIFF block
    const payload = synthetic.subarray(4);
    expect(readOrientation(payload)).toBe(6);
  });

  it('does not re-add an orientation tag when the value is already 1 (normal)', () => {
    const input = jpegWith(JFIF, EXIF_ORIENT_1);
    const result = stripJpeg(input, opts());
    expectBytes(result.bytes, jpegWith(JFIF));
    expect(result.notes).toEqual([]);
  });

  it('removes GPS-bearing EXIF when only GPS stripping is enabled, and keeps clean EXIF', () => {
    const gpsResult = stripJpeg(
      jpegWith(JFIF, EXIF_GPS),
      opts({ stripExif: false, stripGps: true, keepOrientation: false }),
    );
    expect(gpsResult.removed).toHaveLength(1);
    expect(gpsResult.removed[0]!.detail).toMatch(/GPS/);
    expectBytes(gpsResult.bytes, jpegWith(JFIF));

    const clean = jpegWith(JFIF, EXIF_PLAIN);
    const cleanResult = stripJpeg(clean, opts({ stripExif: false, stripGps: true }));
    expectBytes(cleanResult.bytes, clean);
    expect(cleanResult.removed).toEqual([]);
  });

  it('keeps EXIF when both EXIF and GPS stripping are off', () => {
    const input = jpegWith(JFIF, EXIF_GPS);
    const result = stripJpeg(input, opts({ stripExif: false, stripGps: false }));
    expectBytes(result.bytes, input);
    expect(result.unchanged).toBe(true);
  });

  it('removes XMP segments (standard and extended) only when XMP stripping is on', () => {
    const input = jpegWith(JFIF, XMP, XMP_EXTENDED);
    const stripped = stripJpeg(input, opts());
    expect(stripped.removed.map((r) => r.label)).toEqual(['APP1 XMP', 'APP1 extended XMP']);
    expectBytes(stripped.bytes, jpegWith(JFIF));

    const kept = stripJpeg(input, opts({ stripXmp: false }));
    expectBytes(kept.bytes, input);
    expect(kept.unchanged).toBe(true);
  });

  it('removes Photoshop/IPTC APP13 segments but leaves other APP13 segments alone', () => {
    const input = jpegWith(JFIF, IPTC, OTHER_APP13);
    const stripped = stripJpeg(input, opts());
    expect(stripped.removed.map((r) => r.category)).toEqual(['iptc']);
    expectBytes(stripped.bytes, jpegWith(JFIF, OTHER_APP13));

    expectBytes(stripJpeg(input, opts({ stripIptc: false })).bytes, input);
  });

  it('keeps the ICC colour profile by default and removes it on request', () => {
    const input = jpegWith(JFIF, ICC);
    expectBytes(stripJpeg(input, opts()).bytes, input);

    const stripped = stripJpeg(input, opts({ stripIcc: true }));
    expect(stripped.removed.map((r) => r.label)).toEqual(['APP2 ICC profile']);
    expectBytes(stripped.bytes, jpegWith(JFIF));
  });

  it('removes COM comments by default and reports their text', () => {
    const input = jpegWith(JFIF, COM);
    const stripped = stripJpeg(input, opts());
    expect(stripped.removed).toHaveLength(1);
    expect(stripped.removed[0]!.detail).toContain('shot with a secret camera');
    expectBytes(stripped.bytes, jpegWith(JFIF));

    expectBytes(stripJpeg(input, opts({ stripText: false })).bytes, input);
  });

  it('strips several metadata types in one pass, keeping the reference bytes', () => {
    const input = jpegWith(JFIF, EXIF_ORIENT_6, XMP, IPTC, ICC, COM);
    const result = stripJpeg(input, opts({ stripIcc: true, keepOrientation: false }));
    expect(result.removed.map((r) => r.category)).toEqual(['exif', 'xmp', 'iptc', 'icc', 'text']);
    expectBytes(result.bytes, jpegWith(JFIF));
  });

  it('rejects truncated, malformed and non-JPEG input with a ToolError', () => {
    // Declared segment length runs past the end of the buffer.
    expect(() => stripJpeg(concat(u8(0xff, 0xd8), u8(0xff, 0xe1, 0x00, 0x40), u8(1, 2, 3)), opts())).toThrow(
      /truncated or malformed/i,
    );
    // Length field missing entirely.
    expect(() => stripJpeg(u8(0xff, 0xd8, 0xff, 0xe1), opts())).toThrow(/truncated or malformed/i);
    // No scan and no EOI.
    expect(() => stripJpeg(concat(u8(0xff, 0xd8), JFIF), opts())).toThrow(/truncated or malformed/i);
    // Not a JPEG at all.
    expect(() => stripJpeg(ascii('GIF89a'), opts())).toThrow(/not a valid JPEG/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  PNG                                                                       */
/* -------------------------------------------------------------------------- */

describe('stripPng', () => {
  it('removes eXIf and tEXt chunks losslessly, keeping the surviving chunks intact', () => {
    const input = pngWith(PNG_PHYS, PNG_EXIF, PNG_TEXT);
    const result = stripPng(input, opts());

    expect(result.removed.map((r) => r.label)).toEqual(['PNG eXIf chunk', 'tEXt text chunk']);
    expectBytes(result.bytes, pngWith(PNG_PHYS));

    const chunks = pngChunksOf(result.bytes);
    expect(chunks.map((c) => c.type)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);
    // Every surviving chunk still carries a valid CRC32 (whole-chunk removal
    // means no checksum ever needs recomputing).
    expect(chunks.every((c) => c.crcOk)).toBe(true);
    // The kept pHYs chunk is byte-for-byte identical, CRC included.
    expectBytes(chunks[1]!.raw, PNG_PHYS);
  });

  it('detects GPS and orientation in an eXIf chunk that carries the "Exif\\0\\0" signature', () => {
    const input = pngWith(PNG_EXIF_SIGNED);
    const result = stripPng(input, opts());
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0]!.detail).toMatch(/GPS/);
    expect(result.notes.join(' ')).toMatch(/orientation was not re-added/i);
    expectBytes(result.bytes, pngWith());

    const gpsOnly = stripPng(pngWith(PNG_EXIF_SIGNED), opts({ stripExif: false, stripGps: true }));
    expect(gpsOnly.removed).toHaveLength(1);
  });

  it('keeps everything when EXIF, GPS and text stripping are off', () => {
    const input = pngWith(PNG_PHYS, PNG_EXIF, PNG_TEXT);
    const result = stripPng(input, opts({ stripExif: false, stripGps: false, stripText: false }));
    expectBytes(result.bytes, input);
    expect(result.unchanged).toBe(true);
  });

  it('treats the XMP iTXt chunk as XMP (not plain text)', () => {
    const input = pngWith(PNG_XMP, PNG_COMMENT);
    const stripped = stripPng(input, opts({ stripText: false }));
    expect(stripped.removed.map((r) => r.category)).toEqual(['xmp']);
    expectBytes(stripped.bytes, pngWith(PNG_COMMENT));

    const keepXmp = stripPng(input, opts({ stripXmp: false }));
    expect(keepXmp.removed.map((r) => r.category)).toEqual(['text']);
    expectBytes(keepXmp.bytes, pngWith(PNG_XMP));
  });

  it('keeps and removes the iCCP colour profile', () => {
    const input = pngWith(PNG_ICCP);
    expectBytes(stripPng(input, opts()).bytes, input);
    const stripped = stripPng(input, opts({ stripIcc: true }));
    expect(stripped.removed.map((r) => r.label)).toEqual(['PNG iCCP colour profile']);
    expectBytes(stripped.bytes, pngWith());
  });

  it('notes unrecognised ancillary chunks it leaves in place', () => {
    const result = stripPng(pngWith(PNG_PRIVATE), opts());
    expect(result.notes.join(' ')).toMatch(/unrecognised ancillary chunk/i);
    expectBytes(result.bytes, pngWith(PNG_PRIVATE));
  });

  it('refuses to delete a metadata chunk with a bad checksum', () => {
    const corruptText = pngChunk('tEXt', ascii('Author\0Claude'), 0x12345678);
    expect(() => stripPng(pngWith(corruptText), opts())).toThrow(/corrupted \(bad tEXt chunk checksum\)/i);
  });

  it('passes a bad checksum through when the chunk is kept (never touched)', () => {
    const badPhys = pngChunk('pHYs', PHYS_DATA, 0xdeadbeef);
    const input = pngWith(badPhys, PNG_EXIF);
    const result = stripPng(input, opts());
    expectBytes(result.bytes, pngWith(badPhys));
    expect(pngChunksOf(result.bytes)[1]!.crcOk).toBe(false);
  });

  it('rejects truncated, malformed and non-PNG input with a ToolError', () => {
    const full = pngWith(PNG_TEXT);
    expect(() => stripPng(full.subarray(0, full.length - 6), opts())).toThrow(/truncated or malformed/i);
    expect(() => stripPng(concat(PNG_SIG, pngChunk('tEXt', ascii('a\0b'))), opts())).toThrow(/malformed/i);
    expect(() => stripPng(ascii('not a png'), opts())).toThrow(/not a valid PNG/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  WebP                                                                      */
/* -------------------------------------------------------------------------- */

describe('stripWebp', () => {
  it('removes EXIF and XMP chunks, repairs the RIFF size and the VP8X flags', () => {
    const result = stripWebp(WEBP_META, opts());

    expect(result.removed.map((r) => r.label)).toEqual(['WebP EXIF chunk', 'WebP XMP chunk']);
    const chunks = webpChunksOf(result.bytes);
    expect(chunks.map((c) => c.type)).toEqual(['VP8X', 'VP8L', 'ALPH', 'ICCP']);

    // ICCP was kept, so its flag stays; EXIF/XMP flags are cleared; alpha survives.
    expect(chunks[0]!.data[0]).toBe(0x20 | 0x10);
    // Pixel-carrying chunks are byte-for-byte identical.
    expectBytes(chunks[1]!.data, VP8L_DATA);
    expectBytes(chunks[2]!.data, ALPH_DATA);
    // RIFF size covers "WEBP" + the surviving chunks exactly.
    expect(readLe32(result.bytes, 4)).toBe(result.bytes.length - 8);
    expect(detectFormat(result.bytes)).toBe('webp');
  });

  it('removes the ICC profile on request and clears its VP8X flag', () => {
    const result = stripWebp(WEBP_META, opts({ stripIcc: true }));
    const chunks = webpChunksOf(result.bytes);
    expect(chunks.map((c) => c.type)).toEqual(['VP8X', 'VP8L', 'ALPH']);
    expect(chunks[0]!.data[0]).toBe(0x10);
  });

  it('only removes GPS-bearing EXIF when stripping GPS alone', () => {
    const withGps = webp(
      webpChunk('VP8X', VP8X_DATA),
      webpChunk('VP8L', VP8L_DATA),
      webpChunk('EXIF', exifPayload([GPS_POINTER])),
    );
    const result = stripWebp(withGps, opts({ stripExif: false, stripGps: true }));
    expect(result.removed).toHaveLength(1);
    expect(webpChunksOf(result.bytes).map((c) => c.type)).toEqual(['VP8X', 'VP8L']);

    const noGps = webp(
      webpChunk('VP8X', VP8X_DATA),
      webpChunk('VP8L', VP8L_DATA),
      webpChunk('EXIF', exifPayload([ORIENTATION_6])),
    );
    const kept = stripWebp(noGps, opts({ stripExif: false, stripGps: true }));
    expectBytes(kept.bytes, noGps);
    expect(kept.unchanged).toBe(true);
  });

  it('rejects truncated, malformed and non-WebP input with a ToolError', () => {
    const overstated = sliceBytes(WEBP_META);
    writeLe32(overstated, 4, 0x7fffffff);
    expect(() => stripWebp(overstated, opts())).toThrow(/truncated or malformed/i);

    const badChunkSize = sliceBytes(WEBP_META);
    writeLe32(badChunkSize, 16, 0xffff); // VP8L chunk claims more bytes than the file holds
    expect(() => stripWebp(badChunkSize, opts())).toThrow(/truncated or malformed/i);

    expect(() => stripWebp(ascii('RIFF____NOPE'), opts())).toThrow(/not a valid WebP/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  option coercion                                                           */
/* -------------------------------------------------------------------------- */

describe('toStripOptions', () => {
  it('applies the documented defaults when values are missing', () => {
    expect(toStripOptions({})).toEqual({
      stripExif: true,
      stripGps: true,
      stripXmp: true,
      stripIptc: true,
      stripText: true,
      stripIcc: false,
      keepOrientation: true,
    });
  });
  it('honours explicit false/true values', () => {
    expect(toStripOptions({ stripExif: false, stripIcc: true }).stripExif).toBe(false);
    expect(toStripOptions({ stripExif: false, stripIcc: true }).stripIcc).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  tool run                                                                  */
/* -------------------------------------------------------------------------- */

function fileOf(bytes: Uint8Array, name: string, type: string): File {
  return new File([bytes], name, { type });
}

function reportOf(result: FileRunResult): { headers: string[]; rows: string[][] } {
  return JSON.parse(result.report!.output) as { headers: string[]; rows: string[][] };
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

describe('image-strip-metadata run', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects a non-image file before doing any work', async () => {
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('strips a JPEG using the declared defaults and reports what was removed', async () => {
    const input = jpegWith(JFIF, EXIF_ORIENT_6);
    const result = await tool.run({
      files: [fileOf(input, 'photo.jpg', 'image/jpeg')],
      options: {},
    });

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('photo-clean.jpg');
    expect(result.outputs[0]!.blob.type).toBe('image/jpeg');
    expectBytes(await bytesOf(result.outputs[0]!.blob), concat(u8(0xff, 0xd8), JFIF, buildOrientationJpegSegment(6), SOS, ENTROPY, EOI));

    const report = reportOf(result);
    expect(report.headers).toEqual(['File', 'Format', 'Removed', 'Saved', 'Size']);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]![0]).toBe('photo.jpg');
    expect(report.rows[0]![1]).toBe('JPEG');
    expect(report.rows[0]![2]).toMatch(/APP1 EXIF/);
    expect(result.stats).toMatchObject({ files: 1, segmentsRemoved: 1, outputBytes: 2 + JFIF.length + 36 + SOS.length + ENTROPY.length + 2 });
    expect(result.notes!.join(' ')).toMatch(/removed APP1 EXIF/);
  });

  it('leaves metadata-free files byte-identical and says so', async () => {
    const input = jpegWith(JFIF);
    const result = await tool.run({
      files: [fileOf(input, 'clean.jpg', 'image/jpeg')],
      options: {},
    });
    expectBytes(await bytesOf(result.outputs[0]!.blob), input);
    expect(reportOf(result).rows[0]![2]).toMatch(/already clean/i);
    expect(result.notes!.join(' ')).toMatch(/no removable metadata found/i);
    expect(result.stats).toMatchObject({ segmentsRemoved: 0, savedBytes: 0 });
  });

  it('handles a batch across formats, with a per-file report row', async () => {
    const jpeg = jpegWith(JFIF, XMP);
    const png = pngWith(PNG_PHYS, PNG_EXIF, PNG_TEXT);
    const webpBytes = webp(
      webpChunk('VP8X', VP8X_DATA),
      webpChunk('VP8L', VP8L_DATA),
      webpChunk('XMP ', ascii('<x/>')),
    );
    const result = await tool.run({
      files: [
        fileOf(jpeg, 'a.jpg', 'image/jpeg'),
        fileOf(png, 'b.png', 'image/png'),
        fileOf(webpBytes, 'c.webp', 'image/webp'),
      ],
      options: {},
    });

    expect(result.outputs.map((o) => o.filename)).toEqual(['a-clean.jpg', 'b-clean.png', 'c-clean.webp']);
    expectBytes(await bytesOf(result.outputs[0]!.blob), jpegWith(JFIF));
    expectBytes(await bytesOf(result.outputs[1]!.blob), pngWith(PNG_PHYS));
    expect(reportOf(result).rows.map((r) => r[1])).toEqual(['JPEG', 'PNG', 'WebP']);
    expect(result.stats).toMatchObject({ files: 3, segmentsRemoved: 4 });
    expect(result.stats!.savedBytes).toBeGreaterThan(0);
  });

  it('keeps Unicode filenames in outputs and in the report', async () => {
    const name = 'фото-日本 🎞.jpg';
    const result = await tool.run({
      files: [fileOf(jpegWith(JFIF, EXIF_ORIENT_6), name, 'image/jpeg')],
      options: {},
    });
    expect(result.outputs[0]!.filename).toBe('фото-日本 🎞-clean.jpg');
    expect(reportOf(result).rows[0]![0]).toBe(name);
  });

  it('de-duplicates output names when inputs collide', async () => {
    const result = await tool.run({
      files: [
        fileOf(jpegWith(JFIF, EXIF_ORIENT_6), 'photo.jpg', 'image/jpeg'),
        fileOf(jpegWith(JFIF, EXIF_ORIENT_6), 'photo.jpg', 'image/jpeg'),
      ],
      options: {},
    });
    expect(result.outputs.map((o) => o.filename)).toEqual(['photo-clean.jpg', 'photo-clean-2.jpg']);
  });

  it('skips unsupported image formats with a warning, and fails if nothing was strippable', async () => {
    const gif = ascii('GIF89a-not-really-a-gif');
    const mixed = await tool.run({
      files: [
        fileOf(jpegWith(JFIF, EXIF_ORIENT_6), 'photo.jpg', 'image/jpeg'),
        fileOf(gif, 'anim.gif', 'image/gif'),
      ],
      options: {},
    });
    expect(mixed.outputs.map((o) => o.filename)).toEqual(['photo-clean.jpg']);
    expect(mixed.warnings!.join(' ')).toMatch(/anim\.gif.*skipped/i);
    expect(reportOf(mixed).rows[1]![2]).toMatch(/skipped — unsupported format/i);

    await expect(
      tool.run({ files: [fileOf(gif, 'anim.gif', 'image/gif')], options: {} }),
    ).rejects.toThrow(/None of the selected files/i);
  });

  it('throws a clear ToolError for files above the size limit', async () => {
    const big = new File([new Uint8Array(8)], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(big, 'size', { value: MAX_FILE_BYTES + 1 });
    await expect(tool.run({ files: [big], options: {} })).rejects.toThrow(/too large/i);
  });

  it('honours the abort signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({
        files: [fileOf(jpegWith(JFIF, EXIF_ORIENT_6), 'photo.jpg', 'image/jpeg')],
        options: {},
        signal: controller.signal,
      }),
    ).rejects.toThrow(/cancelled/i);
  });

  it('reports progress up to completion', async () => {
    const seen: number[] = [];
    await tool.run({
      files: [fileOf(jpegWith(JFIF, EXIF_ORIENT_6), 'photo.jpg', 'image/jpeg')],
      options: {},
      onProgress: (fraction) => seen.push(fraction),
    });
    expect(seen.at(-1)).toBe(1);
    expect(seen.every((f) => f >= 0 && f <= 1)).toBe(true);
  });

  it('warns when no metadata type is selected', async () => {
    const result = await tool.run({
      files: [fileOf(jpegWith(JFIF, EXIF_ORIENT_6), 'photo.jpg', 'image/jpeg')],
      options: { stripExif: false, stripGps: false, stripXmp: false, stripIptc: false, stripText: false },
    });
    expect(result.warnings!.join(' ')).toMatch(/copied unchanged/i);
    expectBytes(await bytesOf(result.outputs[0]!.blob), jpegWith(JFIF, EXIF_ORIENT_6));
  });

  it('exposes the documented size limit', () => {
    expect(MAX_FILE_BYTES).toBe(64 * 1024 * 1024);
  });
});
