import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { checkFiles, extension, stem } from './common';
import { runBatch } from './image-batch';
import { meta } from './image-strip-metadata.meta';

/** Image containers this tool can rewrite without touching pixel data. */
export type ImageFormat = 'jpeg' | 'png' | 'webp';

/** A single metadata segment / chunk that was dropped from the byte stream. */
export interface RemovedSegment {
  /** Human-readable name, e.g. "APP1 EXIF" or "International text (iTXt)". */
  label: string;
  /** Size of the removed bytes, including its own framing. */
  size: number;
}

export interface StripOptions {
  /** Keep the ICC colour profile (JPEG APP2 / PNG iCCP / WebP ICCP). */
  keepColorProfile: boolean;
  /** Remove JPEG COM comment segments. */
  removeComments: boolean;
}

export interface StripOutcome {
  bytes: Uint8Array<ArrayBuffer>;
  removed: RemovedSegment[];
  /** Per-file notes about side effects (e.g. a dropped EXIF orientation tag). */
  warnings: string[];
}

const EXIF_SIG = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
const XMP_SIG = 'http://ns.adobe.com/xap/1.0/';
const ICC_SIG = 'ICC_PROFILE';
const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

const DEFAULT_OPTIONS: StripOptions = { keepColorProfile: true, removeComments: true };

/* -------------------------------------------------------------------------- */
/*  Byte helpers                                                              */
/* -------------------------------------------------------------------------- */

function ascii(b: Uint8Array, off: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(b[off + i]!);
  return s;
}

function writeAscii(b: Uint8Array, off: number, text: string): void {
  for (let i = 0; i < text.length; i++) b[off + i] = text.charCodeAt(i);
}

function readU32BE(b: Uint8Array, o: number): number {
  return ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
}

function readU32LE(b: Uint8Array, o: number): number {
  return (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;
}

function writeU32LE(b: Uint8Array, o: number, value: number): void {
  b[o] = value & 0xff;
  b[o + 1] = (value >>> 8) & 0xff;
  b[o + 2] = (value >>> 16) & 0xff;
  b[o + 3] = (value >>> 24) & 0xff;
}

function startsWithBytes(data: Uint8Array, prefix: readonly number[]): boolean {
  if (data.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) if (data[i] !== prefix[i]) return false;
  return true;
}

function startsWithText(data: Uint8Array, prefix: string): boolean {
  if (data.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) if (data[i] !== prefix.charCodeAt(i)) return false;
  return true;
}

function concatBytes(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
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

function truncated(format: string): ToolError {
  return new ToolError(
    `That ${format} image looks truncated or corrupted.`,
    'Try a complete, undamaged file.',
  );
}

/**
 * Detect the container from its magic bytes rather than the filename or MIME
 * type, so a mislabelled file is still handled correctly.
 */
export function sniffFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (bytes.length >= 8 && startsWithBytes(bytes, PNG_SIG)) return 'png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return 'webp';
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  JPEG                                                                      */
/* -------------------------------------------------------------------------- */

/** Read the EXIF Orientation tag from an APP1 "Exif\0\0" payload, if present. */
function exifOrientation(app1: Uint8Array): number | null {
  if (!startsWithBytes(app1, EXIF_SIG)) return null;
  const t = 6; // TIFF header starts after "Exif\0\0"
  if (app1.length < t + 8) return null;
  const le = app1[t] === 0x49; // 'I' → little-endian
  const u16 = (p: number): number =>
    le ? app1[p]! | (app1[p + 1]! << 8) : (app1[p]! << 8) | app1[p + 1]!;
  const u32 = (p: number): number =>
    le
      ? (app1[p]! | (app1[p + 1]! << 8) | (app1[p + 2]! << 16) | (app1[p + 3]! << 24)) >>> 0
      : ((app1[p]! << 24) | (app1[p + 1]! << 16) | (app1[p + 2]! << 8) | app1[p + 3]!) >>> 0;
  if (u16(t + 2) !== 42) return null;
  const ifd0 = t + u32(t + 4);
  if (ifd0 + 2 > app1.length) return null;
  const count = u16(ifd0);
  let p = ifd0 + 2;
  for (let i = 0; i < count && p + 12 <= app1.length; i++) {
    if (u16(p) === 0x0112 && u16(p + 2) === 3) {
      const off = p + 8;
      if (off + 2 > app1.length) return null;
      return u16(off);
    }
    p += 12;
  }
  return null;
}

/**
 * Decide whether a JPEG marker carries removable metadata. Returns a label when
 * it should be dropped, or `null` to keep the segment verbatim.
 *
 * APP0 (JFIF/JFXX) and APP14 (Adobe colour transform) are kept because they
 * affect how the file is rendered, not what it reveals.
 */
function removableJpegSegment(
  marker: number,
  payload: Uint8Array,
  opts: StripOptions,
): string | null {
  if (marker === 0xfe) return opts.removeComments ? 'Comment (COM)' : null;
  if (marker < 0xe0 || marker > 0xef || marker === 0xe0 || marker === 0xee) return null;
  if (marker === 0xe1) {
    if (startsWithBytes(payload, EXIF_SIG)) return 'APP1 EXIF';
    if (startsWithText(payload, XMP_SIG)) return 'APP1 XMP';
    return 'APP1 metadata';
  }
  if (marker === 0xe2) {
    if (startsWithText(payload, ICC_SIG)) {
      return opts.keepColorProfile ? null : 'APP2 ICC colour profile';
    }
    return 'APP2 metadata';
  }
  const n = marker - 0xe0;
  if (n === 13) return 'APP13 Photoshop/IPTC';
  return `APP${n} metadata`;
}

function stripJpeg(src: Uint8Array, opts: StripOptions): StripOutcome {
  const parts: Uint8Array[] = [src.subarray(0, 2)]; // SOI
  const removed: RemovedSegment[] = [];
  const warnings: string[] = [];
  let o = 2;
  let sawEoi = false;

  while (o < src.length) {
    if (src[o] !== 0xff) throw truncated('JPEG');
    let j = o;
    while (j < src.length && src[j] === 0xff) j++; // marker fill bytes
    if (j >= src.length) throw truncated('JPEG');
    const marker = src[j]!;

    if (marker === 0x00) {
      throw new ToolError(
        'That JPEG is malformed.',
        'Found a stuffed 0xFF byte outside the image data.',
      );
    }
    if (marker === 0xd9) {
      parts.push(src.subarray(o, j + 1));
      sawEoi = true;
      break;
    }
    // Standalone markers (TEM, RSTn) carry no length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(src.subarray(o, j + 1));
      o = j + 1;
      continue;
    }

    if (j + 3 > src.length) throw truncated('JPEG');
    const len = (src[j + 1]! << 8) | src[j + 2]!;
    if (len < 2) {
      throw new ToolError('That JPEG is malformed.', 'A segment declares an impossible length.');
    }
    const segEnd = j + 1 + len;
    if (segEnd > src.length) throw truncated('JPEG');
    const payload = src.subarray(j + 3, segEnd);

    if (marker === 0xda) {
      // Start of scan: keep the header, then copy entropy-coded data untouched
      // (stuffed 0xFF00 bytes and RSTn markers included).
      parts.push(src.subarray(o, segEnd));
      const scanStart = segEnd;
      let p = scanStart;
      while (p < src.length) {
        if (src[p] === 0xff) {
          const next = p + 1 < src.length ? src[p + 1]! : -1;
          if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
            p += 2;
            continue;
          }
          break;
        }
        p++;
      }
      if (p >= src.length) throw truncated('JPEG');
      parts.push(src.subarray(scanStart, p));
      o = p;
      continue;
    }

    const label = removableJpegSegment(marker, payload, opts);
    if (label) {
      removed.push({ label, size: segEnd - o });
      if (marker === 0xe1 && startsWithBytes(payload, EXIF_SIG)) {
        const orientation = exifOrientation(payload);
        if (orientation !== null && orientation !== 1) {
          warnings.push(
            `EXIF Orientation ${orientation} was removed, so some viewers may show the photo rotated.`,
          );
        }
      }
      if (marker === 0xe2 && startsWithText(payload, ICC_SIG)) {
        warnings.push(
          'The ICC colour profile was removed, so colours may look slightly different.',
        );
      }
    } else {
      parts.push(src.subarray(o, segEnd));
    }
    o = segEnd;
  }

  if (!sawEoi) throw truncated('JPEG');
  return { bytes: concatBytes(parts), removed, warnings };
}

/* -------------------------------------------------------------------------- */
/*  PNG                                                                       */
/* -------------------------------------------------------------------------- */

function removablePngChunk(type: string, opts: StripOptions): string | null {
  switch (type) {
    case 'tEXt':
      return 'Text (tEXt)';
    case 'zTXt':
      return 'Compressed text (zTXt)';
    case 'iTXt':
      return 'International text (iTXt)';
    case 'eXIf':
      return 'EXIF (eXIf)';
    case 'tIME':
      return 'Modification time (tIME)';
    case 'iCCP':
      return opts.keepColorProfile ? null : 'ICC colour profile (iCCP)';
    default:
      return null;
  }
}

function stripPng(src: Uint8Array, opts: StripOptions): StripOutcome {
  if (src.length < 8 || !startsWithBytes(src, PNG_SIG)) {
    throw new ToolError('That file is not a valid PNG.', 'It is missing the PNG signature.');
  }
  const parts: Uint8Array[] = [src.subarray(0, 8)];
  const removed: RemovedSegment[] = [];
  const warnings: string[] = [];
  let o = 8;
  let sawIhdr = false;
  let sawIend = false;

  while (o + 12 <= src.length) {
    const len = readU32BE(src, o);
    const type = ascii(src, o + 4, 4);
    if (!/^[A-Za-z]{4}$/.test(type)) {
      throw new ToolError('That PNG is malformed.', 'A chunk has an invalid type code.');
    }
    const chunkEnd = o + 8 + len + 4;
    if (chunkEnd > src.length) throw truncated('PNG');
    if (!sawIhdr && type !== 'IHDR') {
      throw new ToolError('That PNG is malformed.', 'The IHDR header chunk must come first.');
    }
    if (type === 'IHDR') sawIhdr = true;

    const label = removablePngChunk(type, opts);
    if (label) {
      removed.push({ label, size: chunkEnd - o });
      if (type === 'iCCP') {
        warnings.push(
          'The ICC colour profile was removed, so colours may look slightly different.',
        );
      }
    } else {
      parts.push(src.subarray(o, chunkEnd));
    }

    o = chunkEnd;
    if (type === 'IEND') {
      sawIend = true;
      break;
    }
  }

  if (!sawIhdr) throw truncated('PNG');
  if (!sawIend) throw truncated('PNG');
  // Preserve anything after IEND so the rewrite is byte-for-byte apart from the
  // removed metadata chunks.
  if (o < src.length) parts.push(src.subarray(o));
  return { bytes: concatBytes(parts), removed, warnings };
}

/* -------------------------------------------------------------------------- */
/*  WebP                                                                      */
/* -------------------------------------------------------------------------- */

function removableWebpChunk(fourcc: string, opts: StripOptions): string | null {
  if (fourcc === 'EXIF') return 'EXIF chunk';
  if (fourcc === 'XMP ') return 'XMP chunk';
  if (fourcc === 'ICCP') return opts.keepColorProfile ? null : 'ICC colour profile (ICCP)';
  return null;
}

interface WebpChunk {
  fourcc: string;
  data: Uint8Array;
}

function stripWebp(src: Uint8Array, opts: StripOptions): StripOutcome {
  if (src.length < 12 || ascii(src, 0, 4) !== 'RIFF' || ascii(src, 8, 4) !== 'WEBP') {
    throw new ToolError('That file is not a valid WebP.', 'It is missing the RIFF/WEBP header.');
  }
  const declared = readU32LE(src, 4);
  const end = declared + 8;
  if (end < 12 || end > src.length) throw truncated('WebP');

  const removed: RemovedSegment[] = [];
  const warnings: string[] = [];
  const chunks: WebpChunk[] = [];
  let o = 12;

  while (o + 8 <= end) {
    const fourcc = ascii(src, o, 4);
    const size = readU32LE(src, o + 4);
    const dataStart = o + 8;
    const dataEnd = dataStart + size;
    const chunkEnd = dataEnd + (size & 1); // chunks are padded to an even size
    if (chunkEnd > end) throw truncated('WebP');

    const label = removableWebpChunk(fourcc, opts);
    if (label) {
      removed.push({ label, size: chunkEnd - o });
      if (fourcc === 'ICCP') {
        warnings.push(
          'The ICC colour profile was removed, so colours may look slightly different.',
        );
      }
    } else {
      chunks.push({ fourcc, data: src.subarray(dataStart, dataEnd) });
    }
    o = chunkEnd;
  }
  if (o !== end) throw truncated('WebP');

  const has = (cc: string): boolean => chunks.some((c) => c.fourcc === cc);
  if (!has('VP8X') && !has('VP8 ') && !has('VP8L')) {
    throw new ToolError('That file is not a valid WebP.', 'No image data chunk was found.');
  }

  // The VP8X header advertises which metadata chunks exist; clearing the bits
  // keeps the container consistent after removal.
  for (const chunk of chunks) {
    if (chunk.fourcc !== 'VP8X' || chunk.data.length < 1) continue;
    const data = new Uint8Array(chunk.data);
    let flags = data[0]!;
    flags = (flags & ~0x20) | (has('ICCP') ? 0x20 : 0);
    flags = (flags & ~0x08) | (has('EXIF') ? 0x08 : 0);
    flags = (flags & ~0x04) | (has('XMP ') ? 0x04 : 0);
    data[0] = flags;
    chunk.data = data;
  }

  const body: Uint8Array[] = [];
  let total = 4; // "WEBP"
  for (const chunk of chunks) {
    const pad = chunk.data.length & 1;
    const header = new Uint8Array(8);
    writeAscii(header, 0, chunk.fourcc);
    writeU32LE(header, 4, chunk.data.length);
    body.push(header, chunk.data);
    if (pad) body.push(new Uint8Array(1));
    total += 8 + chunk.data.length + pad;
  }

  const out = new Uint8Array(8 + total);
  writeAscii(out, 0, 'RIFF');
  writeU32LE(out, 4, total);
  writeAscii(out, 8, 'WEBP');
  let p = 12;
  for (const part of body) {
    out.set(part, p);
    p += part.length;
  }
  return { bytes: out, removed, warnings };
}

/* -------------------------------------------------------------------------- */
/*  Dispatch                                                                  */
/* -------------------------------------------------------------------------- */

/** Strip metadata from a supported image entirely in memory. */
export function stripImage(
  bytes: Uint8Array,
  format: ImageFormat,
  opts: StripOptions = DEFAULT_OPTIONS,
): StripOutcome {
  if (format === 'jpeg') return stripJpeg(bytes, opts);
  if (format === 'png') return stripPng(bytes, opts);
  return stripWebp(bytes, opts);
}

function mimeFor(format: ImageFormat): string {
  return format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : 'image/webp';
}

/* -------------------------------------------------------------------------- */
/*  Tool entry point                                                          */
/* -------------------------------------------------------------------------- */

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, true);

  const opts: StripOptions = {
    keepColorProfile: o.keepColorProfile !== false,
    removeComments: o.removeComments !== false,
  };

  const rows: string[][] = [];
  const notes: string[] = [];
  const warnings: string[] = [];
  let removedItems = 0;
  let removedBytes = 0;
  let outputBytes = 0;

  const outputs = await runBatch(input.files, input, 'Stripping', async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!bytes.length) {
      throw new ToolError(`“${file.name}” is empty.`, 'Choose a real image file.');
    }
    const format = sniffFormat(bytes);
    if (!format) {
      throw new ToolError(
        `“${file.name}” is not a supported image.`,
        'This tool strips metadata from JPEG, PNG and WebP files only. Convert GIF, BMP or AVIF files first.',
      );
    }

    const outcome = stripImage(bytes, format, opts);

    for (const item of outcome.removed) {
      rows.push([file.name, item.label, item.size.toLocaleString()]);
    }
    const count = outcome.removed.length;
    const size = outcome.removed.reduce((sum, item) => sum + item.size, 0);
    removedItems += count;
    removedBytes += size;
    if (count) {
      notes.push(
        `${file.name}: removed ${count} metadata segment${count === 1 ? '' : 's'} (${size.toLocaleString()} bytes).`,
      );
    } else {
      notes.push(`${file.name}: no removable metadata found; the file was copied unchanged.`);
    }
    for (const warning of outcome.warnings) warnings.push(`${file.name}: ${warning}`);

    outputBytes += outcome.bytes.length;
    const mime = mimeFor(format);
    return {
      filename: `${stem(file.name)}-clean.${extension(mime)}`,
      blob: new Blob([outcome.bytes], { type: mime }),
    };
  });

  if (!rows.length) rows.push(['—', 'No removable metadata found', '0']);

  return {
    outputs,
    report: {
      output: JSON.stringify({ headers: ['File', 'Removed', 'Bytes'], rows }),
      render: 'table',
    },
    notes: [...notes, 'Image data was copied byte-for-byte; nothing was re-encoded or uploaded.'],
    warnings: warnings.length ? warnings : undefined,
    stats: {
      files: outputs.length,
      removed: removedItems,
      removedBytes,
      outputBytes,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
