import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { checkFiles } from './common';
import { assertCanvasBudget, decodeOriented, runBatch } from './image-batch';
import { unzlibSync } from 'fflate';
import { meta } from './image-metadata.meta';

/* -------------------------------------------------------------------------- */
/*  JPEG EXIF (TIFF) parsing                                                  */
/* -------------------------------------------------------------------------- */

/** TIFF tags stored in IFD0 (the primary image directory). */
const IFD0_TAGS: Record<number, string> = {
  0x010e: 'ImageDescription',
  0x010f: 'Make',
  0x0110: 'Model',
  0x0112: 'Orientation',
  0x011a: 'XResolution',
  0x011b: 'YResolution',
  0x0128: 'ResolutionUnit',
  0x0131: 'Software',
  0x0132: 'DateTime',
  0x013b: 'Artist',
  0x8298: 'Copyright',
};

/** TIFF tags stored in the Exif sub-IFD (reached via the 0x8769 pointer). */
const EXIF_TAGS: Record<number, string> = {
  0x829a: 'ExposureTime',
  0x829d: 'FNumber',
  0x8822: 'ExposureProgram',
  0x8827: 'ISO',
  0x9003: 'DateTimeOriginal',
  0x9004: 'DateTimeDigitized',
  0x9204: 'ExposureBias',
  0x9207: 'MeteringMode',
  0x9209: 'Flash',
  0x920a: 'FocalLength',
  0x9286: 'UserComment',
  0xa001: 'ColourSpace',
  0xa002: 'PixelXDimension',
  0xa003: 'PixelYDimension',
  0xa402: 'ExposureMode',
  0xa403: 'WhiteBalance',
  0xa405: 'FocalLength35mm',
  0xa434: 'LensModel',
};

const EXIF_IFD_POINTER = 0x8769;

/** Human-readable meaning of the EXIF Orientation tag (1–8). */
const ORIENTATION_MEANING: Record<number, string> = {
  1: 'Normal (no rotation)',
  2: 'Mirrored horizontally',
  3: 'Rotated 180°',
  4: 'Mirrored vertically',
  5: 'Mirrored horizontally, rotated 270° clockwise',
  6: 'Rotated 90° clockwise',
  7: 'Mirrored horizontally, rotated 90° clockwise',
  8: 'Rotated 270° clockwise',
};

/** Bytes-per-value for the IFD types we understand. */
function typeSize(type: number): number {
  switch (type) {
    case 1: // BYTE
    case 2: // ASCII
    case 6: // SBYTE
    case 7: // UNDEFINED
      return 1;
    case 3: // SHORT
    case 8: // SSHORT
      return 2;
    case 4: // LONG
    case 9: // SLONG
    case 11: // FLOAT
      return 4;
    case 5: // RATIONAL
    case 10: // SRATIONAL
    case 12: // DOUBLE
      return 8;
    default:
      return 1;
  }
}

interface ValueReader {
  readonly u8: (a: number) => number;
  readonly u16: (a: number) => number;
  readonly u32: (a: number) => number;
}

/**
 * Read a single IFD value. `off` points at the 12-byte entry's 4-byte value
 * field: for values that occupy ≤ 4 bytes the data is inline, otherwise that
 * field holds an offset to the data. TIFF store offsets relative to the TIFF
 * header, hence `origin + r.u32(off)`.
 */
function readIfdValue(
  buf: ArrayBuffer,
  r: ValueReader,
  origin: number,
  off: number,
  type: number,
  count: number,
): string | number {
  const raw = new Uint8Array(buf);
  const totalBytes = count * typeSize(type);
  const at = totalBytes <= 4 ? off : origin + r.u32(off);

  if (type === 2 || type === 7) {
    // ASCII / UNDEFINED — decode the text up to the first NUL.
    let s = '';
    for (let i = 0; i < count && at + i < raw.length; i++) {
      const c = raw[at + i];
      if (c === undefined || c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }

  switch (type) {
    case 1:
    case 6:
      return r.u8(at);
    case 3:
    case 8:
      return r.u16(at);
    case 4:
    case 9:
    case 11:
      return r.u32(at);
    case 5:
    case 10: {
      const denom = r.u32(at + 4);
      return denom ? Math.round((r.u32(at) / denom) * 1000) / 1000 : 0;
    }
    case 12: {
      const denom = r.u32(at + 4);
      return denom ? Math.round((r.u32(at) / denom) * 1000) / 1000 : 0;
    }
    default:
      return r.u8(at);
  }
}

interface TiffContext {
  buf: ArrayBuffer;
  r: ValueReader;
  tiffStart: number;
}

/** Walk one IFD, collecting known tags; returns the Exif sub-IFD offset if present. */
function readIfd(
  ctx: TiffContext,
  ifdOffset: number,
  tags: Record<number, string>,
  out: Record<string, string | number>,
): number {
  const { buf, r, tiffStart } = ctx;
  const ifd = tiffStart + ifdOffset;
  if (ifd < 0 || ifd + 2 > buf.byteLength) return 0;

  const entries = r.u16(ifd);
  let subIfd = 0;
  let p = ifd + 2;
  for (let i = 0; i < entries; i++) {
    if (p + 12 > buf.byteLength) break;
    const tag = r.u16(p);
    const type = r.u16(p + 2);
    const count = r.u32(p + 4);
    if (tag === EXIF_IFD_POINTER) {
      subIfd = Number(readIfdValue(buf, r, tiffStart, p + 8, type, count));
    } else {
      const name = tags[tag];
      if (name) out[name] = readIfdValue(buf, r, tiffStart, p + 8, type, count);
    }
    p += 12;
  }
  return subIfd;
}

/** Parse a TIFF header at `t` and read IFD0 plus the Exif sub-IFD into `out`. */
function parseTiff(buf: ArrayBuffer, t: number, out: Record<string, string | number>): void {
  if (t < 0 || t + 8 > buf.byteLength) return;
  const d = new DataView(buf);
  const byteOrder = d.getUint8(t);
  if (byteOrder !== 0x49 && byteOrder !== 0x4d) return; // 'I' (LE) or 'M' (BE)
  const le = byteOrder === 0x49;
  const within = (a: number, size: number) => a >= 0 && a + size <= buf.byteLength;
  const r: ValueReader = {
    u8: (a) => (within(a, 1) ? d.getUint8(a) : 0),
    u16: (a) => (within(a, 2) ? d.getUint16(a, le) : 0),
    u32: (a) => (within(a, 4) ? d.getUint32(a, le) : 0),
  };
  if (r.u16(t + 2) !== 42) return; // not a TIFF header

  const ctx: TiffContext = { buf, r, tiffStart: t };
  const exifIfd = readIfd(ctx, r.u32(t + 4), IFD0_TAGS, out);
  if (exifIfd) readIfd(ctx, exifIfd, EXIF_TAGS, out);
}

/**
 * Parse a JPEG APP1 "Exif\0\0" segment and return a record of known tags.
 * Returns an empty object when no readable EXIF block is present.
 */
export function readExif(buf: ArrayBuffer): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (buf.byteLength < 4) return out;
  const d = new DataView(buf);
  const exifSig = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"

  let o = 0;
  while (o + 4 <= buf.byteLength) {
    if (d.getUint8(o) !== 0xff) {
      o++;
      continue;
    }
    const marker = d.getUint8(o + 1);
    if (marker === 0xff) {
      o++; // fill byte
      continue;
    }
    if (marker === 0xd8 || marker === 0xd9) {
      o += 2; // SOI / EOI carry no length
      continue;
    }
    if (marker === 0xda) break; // start of scan — metadata segments are done
    const segLen = d.getUint16(o + 2);
    if (segLen < 2) break;

    if (marker === 0xe1 && o + 4 + exifSig.length <= buf.byteLength) {
      const isExif = exifSig.every((byte, i) => d.getUint8(o + 4 + i) === byte);
      if (isExif) {
        parseTiff(buf, o + 10, out);
        break;
      }
    }
    o += 2 + segLen;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  PNG chunk parsing                                                         */
/* -------------------------------------------------------------------------- */

const PNG_COLOUR_TYPES: Record<number, string> = {
  0: 'Greyscale',
  2: 'Truecolour',
  3: 'Indexed',
  4: 'Greyscale + alpha',
  6: 'Truecolour + alpha',
};

const decoder = new TextDecoder();

function nulAt(d: Uint8Array, from: number, end: number): number {
  for (let i = from; i < end; i++) if (d[i] === 0) return i;
  return -1;
}

/** Inflate a zlib stream from `bytes`, returning '' if it cannot be decoded. */
function inflateText(bytes: Uint8Array): string {
  try {
    return decoder.decode(unzlibSync(bytes));
  } catch {
    return '';
  }
}

/** Parse selected PNG chunk metadata (IHDR, pHYs, tEXt, zTXt, iTXt, tIME). */
export function decodePngChunks(buf: ArrayBuffer): Record<string, string | number> {
  const d = new Uint8Array(buf);
  const out: Record<string, string | number> = {};
  if (d.length < 24 || d[0] !== 137 || d[1] !== 80 || d[2] !== 78 || d[3] !== 71) return out;

  const u32 = (o: number): number =>
    (((d[o]! << 24) >>> 0) | ((d[o + 1]! << 16) >>> 0) | ((d[o + 2]! << 8) >>> 0) | d[o + 3]!) >>> 0;

  let o = 8;
  while (o + 8 <= d.length) {
    const len = u32(o);
    const type = String.fromCharCode(d[o + 4]!, d[o + 5]!, d[o + 6]!, d[o + 7]!);
    const start = o + 8;
    const dataEnd = start + len;
    if (!Number.isSafeInteger(dataEnd) || dataEnd > d.length || dataEnd < start) break;

    if (type === 'IHDR' && len >= 13) {
      out['Bit depth'] = `${d[start + 8]} bit`;
      out['Colour type'] = PNG_COLOUR_TYPES[d[start + 9]!] ?? `Unknown (${d[start + 9]})`;
    } else if (type === 'pHYs' && len >= 9) {
      const x = u32(start);
      const y = u32(start + 4);
      const unit = d[start + 8];
      if (unit === 1) {
        const dpi = (ppm: number) => Math.round(ppm * 0.0254);
        out['Pixel density'] = `${x}×${y} px/m (≈${dpi(x)}×${dpi(y)} dpi)`;
      } else {
        out['Pixel density'] = `${x}×${y} px`;
      }
    } else if (type === 'tEXt') {
      const nul = nulAt(d, start, dataEnd);
      if (nul !== -1) {
        const key = decoder.decode(d.slice(start, nul));
        out[key] = decoder.decode(d.slice(nul + 1, dataEnd));
      }
    } else if (type === 'zTXt') {
      const nul = nulAt(d, start, dataEnd);
      if (nul !== -1 && nul + 1 < dataEnd) {
        const key = decoder.decode(d.slice(start, nul));
        out[key] = inflateText(d.slice(nul + 2, dataEnd)); // skip the compression method byte
      }
    } else if (type === 'iTXt') {
      const keyEnd = nulAt(d, start, dataEnd);
      if (keyEnd !== -1 && keyEnd + 2 < dataEnd) {
        const key = decoder.decode(d.slice(start, keyEnd));
        const compressed = d[keyEnd + 1] === 1;
        const langEnd = nulAt(d, keyEnd + 3, dataEnd);
        const textStart = langEnd === -1 ? -1 : nulAt(d, langEnd + 1, dataEnd);
        if (textStart !== -1) {
          const textBytes = d.slice(textStart + 1, dataEnd);
          out[key] = compressed ? inflateText(textBytes) : decoder.decode(textBytes);
        }
      }
    } else if (type === 'tIME' && len >= 7) {
      const year = (d[start]! << 8) | d[start + 1]!;
      const month = String(d[start + 2]!).padStart(2, '0');
      const day = String(d[start + 3]!).padStart(2, '0');
      const hour = String(d[start + 4]!).padStart(2, '0');
      const minute = String(d[start + 5]!).padStart(2, '0');
      const second = String(d[start + 6]!).padStart(2, '0');
      out['Modified'] = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }

    o = dataEnd + 4; // skip the CRC
    if (type === 'IEND') break;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Tool entry point                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Inspect one image and return its `[tag, value]` rows: file details, decoded
 * pixel dimensions (EXIF orientation applied, matching the other image tools)
 * plus any readable JPEG EXIF or PNG chunk metadata.
 */
async function inspectFile(file: File): Promise<[string, string][]> {
  const buf = await file.arrayBuffer();

  const rows: [string, string][] = [
    ['Filename', file.name],
    ['MIME type', file.type || 'unknown'],
    ['File size', `${file.size} bytes`],
  ];

  const bitmap = await decodeOriented(file);
  try {
    assertCanvasBudget(bitmap.width, bitmap.height, 'image');
    rows.push(['Pixel dimensions', `${bitmap.width} × ${bitmap.height}`]);
  } finally {
    bitmap.close();
  }

  if (file.type === 'image/jpeg') {
    const exif = readExif(buf);
    for (const [k, v] of Object.entries(exif)) rows.push([k, String(v)]);
    const orientation = exif.Orientation;
    if (typeof orientation === 'number' && ORIENTATION_MEANING[orientation]) {
      rows.push(['Orientation (meaning)', ORIENTATION_MEANING[orientation]!]);
      if (orientation >= 5) {
        rows.push(['Pixel dimensions note', 'includes the EXIF orientation turn']);
      }
    }
  } else if (file.type === 'image/png') {
    const png = decodePngChunks(buf);
    for (const [k, v] of Object.entries(png)) rows.push([k, String(v)]);
  }

  return rows;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  checkFiles(input.files, true);

  // Batch mode: one table for every selected file, prefixed with its name.
  const multiple = input.files.length > 1;
  const perFile = await runBatch(input.files, input, 'Reading', (file) => inspectFile(file));

  const rows: string[][] = [];
  perFile.forEach((fileRows, index) => {
    const name = input.files[index]!.name;
    for (const [tag, value] of fileRows) rows.push(multiple ? [name, tag, value] : [tag, value]);
  });

  return {
    outputs: [],
    report: {
      output: JSON.stringify({
        headers: multiple ? ['File', 'Tag', 'Value'] : ['Tag', 'Value'],
        rows,
      }),
      render: 'table',
    },
    stats: { files: input.files.length, tags: rows.length },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
