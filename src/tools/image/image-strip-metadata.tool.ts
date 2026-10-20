/**
 * Lossless image metadata stripper (JPEG / PNG / WebP).
 *
 * Pixels are never re-encoded. Each container is walked and the metadata
 * segments/chunks are dropped from the byte stream while everything else —
 * including the entropy-coded scan — is copied through verbatim:
 *
 *   JPEG  APP1 "Exif\0\0" (EXIF, incl. GPS), APP1 XMP, APP13 Photoshop/IPTC,
 *         APP2 ICC_PROFILE and COM comments.
 *   PNG   whole ancillary chunks: eXIf, tEXt/iTXt/zTXt/tIME and iCCP. Because
 *         only whole chunks are cut, the surviving chunks keep their original
 *         CRC32 untouched, so no checksum ever needs recomputing.
 *   WebP  RIFF chunks EXIF / "XMP " / ICCP, with the RIFF size and the VP8X
 *         feature flags repaired.
 *
 * `run()` is a pure byte transform, so it works identically in the tool Web
 * Worker and in unit tests.
 */

import type {
  FileRunInput,
  FileRunResult,
  FileToolModule,
  OptionValues,
  OutputFile,
} from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { formatBytes } from '@/lib/format';
import { checkAbort, checkFiles, stem } from './common';
import { meta } from './image-strip-metadata.meta';

/** Guard rail: the input and its cleaned copy are both held in memory. */
export const MAX_FILE_BYTES = 64 * 1024 * 1024; // 64 MB

export type StripCategory = 'exif' | 'gps' | 'xmp' | 'iptc' | 'text' | 'icc';
export type ImageFormat = 'jpeg' | 'png' | 'webp';

export interface StripOptions {
  stripExif: boolean;
  stripGps: boolean;
  stripXmp: boolean;
  stripIptc: boolean;
  stripText: boolean;
  stripIcc: boolean;
  keepOrientation: boolean;
}

export interface RemovedSegment {
  category: StripCategory;
  /** Container-level label, e.g. "APP1 EXIF" or "PNG eXIf chunk". */
  label: string;
  /** Container bytes removed (marker + length field + payload). */
  bytes: number;
  /** What was inside, when it is worth calling out (e.g. GPS coordinates). */
  detail?: string;
}

export interface StripOutcome {
  /** The cleaned container. */
  bytes: Uint8Array;
  /** True when the output is byte-for-byte identical to the input. */
  unchanged: boolean;
  removed: RemovedSegment[];
  notes: string[];
  warnings: string[];
}

/* -------------------------------------------------------------------------- */
/*  Small byte helpers                                                        */
/* -------------------------------------------------------------------------- */

function ascii(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function matches(buf: Uint8Array, offset: number, sig: Uint8Array): boolean {
  if (offset < 0 || offset + sig.length > buf.length) return false;
  for (let i = 0; i < sig.length; i++) if (buf[offset + i] !== sig[i]) return false;
  return true;
}

function be32(b: Uint8Array, o: number): number {
  return ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
}

function le32(b: Uint8Array, o: number): number {
  return ((b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0);
}

function writeLe32(b: Uint8Array, o: number, value: number): void {
  b[o] = value & 0xff;
  b[o + 1] = (value >>> 8) & 0xff;
  b[o + 2] = (value >>> 16) & 0xff;
  b[o + 3] = (value >>> 24) & 0xff;
}

function fourcc(b: Uint8Array, o: number): string {
  return String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
}

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const part of parts) {
    out.set(part, o);
    o += part.length;
  }
  return out;
}

function corrupt(message: string): ToolError {
  return new ToolError(message, 'Re-save the image and try again.');
}

/** CRC-32 (IEEE 802.3), used to verify PNG chunks before deleting them. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* -------------------------------------------------------------------------- */
/*  Container signatures                                                      */
/* -------------------------------------------------------------------------- */

const PNG_SIG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const RIFF_SIG = ascii('RIFF');
const WEBP_SIG = ascii('WEBP');

const EXIF_SIG = ascii('Exif\0\0');
const XMP_SIG = ascii('http://ns.adobe.com/xap/1.0/');
const XMP_EXT_SIG = ascii('http://ns.adobe.com/xmp/extension/');
const PHOTOSHOP_SIG = ascii('Photoshop 3.0');
const ICC_SIG = ascii('ICC_PROFILE');
const XMP_TEXT_KEY = ascii('XML:com.adobe.xmp');

/** Identify the container from its magic bytes (more reliable than `File.type`). */
export function detectFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (matches(bytes, 0, PNG_SIG)) return 'png';
  if (bytes.length >= 12 && matches(bytes, 0, RIFF_SIG) && matches(bytes, 8, WEBP_SIG)) {
    return 'webp';
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  TIFF / EXIF helpers                                                       */
/* -------------------------------------------------------------------------- */

const TIFF_TYPE_SIZE: Record<number, number> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  6: 1, // SBYTE
  7: 1, // UNDEFINED
  8: 2, // SSHORT
  9: 4, // SLONG
  10: 8, // SRATIONAL
  11: 4, // FLOAT
  12: 8, // DOUBLE
};

interface TiffEntry {
  type: number;
  count: number;
  /** Absolute offset (inside `data`) of the entry's value area. */
  valueOffset: number;
}

/**
 * Find an IFD0 tag inside a TIFF block. JPEG APP1 and WebP EXIF payloads start
 * with the "Exif\0\0" signature; PNG eXIf payloads usually do not — handle both.
 */
function exifTiffStart(payload: Uint8Array): number {
  return matches(payload, 0, EXIF_SIG) ? 6 : 0;
}

function findTiffTag(data: Uint8Array, tiffStart: number, tag: number): TiffEntry | null {
  if (tiffStart + 8 > data.length) return null;
  const order = data[tiffStart]!;
  const le = order === 0x49; // 'I' → little-endian
  if (!le && order !== 0x4d) return null; // 'M' → big-endian
  const u16 = (o: number): number =>
    le ? data[o]! | (data[o + 1]! << 8) : (data[o]! << 8) | data[o + 1]!;
  const u32 = (o: number): number => (le ? le32(data, o) : be32(data, o));
  if (u16(tiffStart + 2) !== 42) return null;
  const ifd = tiffStart + u32(tiffStart + 4);
  if (ifd + 2 > data.length) return null;
  const entries = u16(ifd);
  for (let k = 0, p = ifd + 2; k < entries && p + 12 <= data.length; k++, p += 12) {
    if (u16(p) !== tag) continue;
    const type = u16(p + 2);
    const count = u32(p + 4);
    const size = count * (TIFF_TYPE_SIZE[type] ?? 1);
    // Values of ≤ 4 bytes live inside the entry itself; bigger ones are offsets
    // relative to the start of the TIFF block.
    return { type, count, valueOffset: size <= 4 ? p + 8 : tiffStart + u32(p + 8) };
  }
  return null;
}

/** Does this EXIF block carry a GPS sub-IFD pointer (tag 0x8825)? */
export function hasGpsIfd(payload: Uint8Array): boolean {
  return findTiffTag(payload, exifTiffStart(payload), 0x8825) !== null;
}

/** Read the Orientation tag (0x0112), when present and sane (1–8). */
export function readOrientation(payload: Uint8Array): number | undefined {
  const tiffStart = exifTiffStart(payload);
  const entry = findTiffTag(payload, tiffStart, 0x0112);
  if (!entry || entry.count < 1) return undefined;
  let value: number | undefined;
  if (entry.type === 3 && entry.valueOffset + 2 <= payload.length) {
    value =
      payload[tiffStart] === 0x49
        ? payload[entry.valueOffset]! | (payload[entry.valueOffset + 1]! << 8)
        : (payload[entry.valueOffset]! << 8) | payload[entry.valueOffset + 1]!;
  } else if (entry.type === 4 && entry.valueOffset + 4 <= payload.length) {
    value =
      payload[tiffStart] === 0x49
        ? le32(payload, entry.valueOffset)
        : be32(payload, entry.valueOffset);
  }
  return value !== undefined && value >= 1 && value <= 8 ? value : undefined;
}

/**
 * Build the smallest possible APP1 segment that carries just an Orientation
 * tag, so a stripped photo still displays upright. Little-endian TIFF, one IFD0
 * entry, 36 bytes total — no re-encoding of image data.
 */
export function buildOrientationJpegSegment(orientation: number): Uint8Array {
  const out = new Uint8Array(36);
  let o = 0;
  const u8 = (v: number): void => {
    out[o++] = v & 0xff;
  };
  const u16 = (v: number): void => {
    u8(v);
    u8(v >> 8);
  };
  const u32 = (v: number): void => {
    u16(v & 0xffff);
    u16((v >>> 16) & 0xffff);
  };
  u8(0xff);
  u8(0xe1);
  u16(34); // segment length: 2 for the field itself + 32 bytes of payload
  for (const ch of EXIF_SIG) u8(ch); // "Exif\0\0"
  u8(0x49);
  u8(0x49); // "II" → little-endian
  u16(42); // TIFF magic
  u32(8); // IFD0 offset
  u16(1); // one entry
  u16(0x0112); // Orientation
  u16(3); // SHORT
  u32(1); // count
  u16(orientation);
  u16(0); // inline value padding
  u32(0); // no next IFD
  return out;
}

/* -------------------------------------------------------------------------- */
/*  JPEG                                                                      */
/* -------------------------------------------------------------------------- */

/** First ~40 readable characters of a COM comment, for the report. */
function commentPreview(payload: Uint8Array): string | undefined {
  let text = '';
  for (let i = 0; i < payload.length && text.length < 40; i++) {
    const c = payload[i]!;
    if (c === 0) break;
    text += c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : '·';
  }
  return text ? `comment "${text.trim()}"` : undefined;
}

export function stripJpeg(input: Uint8Array, opts: StripOptions): StripOutcome {
  const b = input;
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) {
    throw new ToolError('That file is not a valid JPEG image.', 'Pick a JPEG file (.jpg or .jpeg).');
  }

  const parts: Uint8Array[] = [b.subarray(0, 2)];
  const removed: RemovedSegment[] = [];
  const notes: string[] = [];
  const warnings: string[] = [];
  const truncated = (): ToolError =>
    corrupt('That JPEG is truncated or malformed, so it was left alone.');

  let i = 2;
  let ended = false;

  while (i < b.length) {
    if (b[i] !== 0xff) throw truncated();
    const markerStart = i;
    while (i < b.length && b[i] === 0xff) i++; // skip 0xff fill bytes
    if (i >= b.length) throw truncated();
    const marker = b[i]!;
    i++;

    // Standalone markers carry no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(b.subarray(markerStart, i));
      continue;
    }
    if (marker === 0x00) throw truncated(); // byte-stuffing outside the scan
    // SOS (0xda) starts the entropy-coded scan and EOI (0xd9) ends the image:
    // from here on every remaining byte is copied verbatim.
    if (marker === 0xda || marker === 0xd9) {
      parts.push(b.subarray(markerStart));
      ended = true;
      break;
    }

    if (i + 2 > b.length) throw truncated();
    const segLen = (b[i]! << 8) | b[i + 1]!;
    if (segLen < 2 || i + segLen > b.length) throw truncated();
    const payload = b.subarray(i + 2, i + segLen);
    const segmentEnd = i + segLen;
    const segmentBytes = segmentEnd - markerStart;

    let drop: RemovedSegment | null = null;

    if (marker === 0xe1) {
      if (matches(payload, 0, EXIF_SIG)) {
        const gps = hasGpsIfd(payload);
        if (opts.stripExif || (opts.stripGps && gps)) {
          drop = {
            category: 'exif',
            label: 'APP1 EXIF',
            bytes: segmentBytes,
            detail: gps ? 'contained GPS coordinates' : undefined,
          };
          if (opts.keepOrientation) {
            const orientation = readOrientation(payload);
            if (orientation !== undefined && orientation !== 1) {
              parts.push(buildOrientationJpegSegment(orientation));
              notes.push(`Re-added a minimal EXIF block so Orientation (${orientation}) survives.`);
            }
          }
        }
      } else if (matches(payload, 0, XMP_SIG) || matches(payload, 0, XMP_EXT_SIG)) {
        if (opts.stripXmp) {
          const extended = matches(payload, 0, XMP_EXT_SIG);
          drop = {
            category: 'xmp',
            label: extended ? 'APP1 extended XMP' : 'APP1 XMP',
            bytes: segmentBytes,
          };
        }
      }
    } else if (marker === 0xe2 && opts.stripIcc && matches(payload, 0, ICC_SIG)) {
      drop = { category: 'icc', label: 'APP2 ICC profile', bytes: segmentBytes };
    } else if (marker === 0xed && opts.stripIptc && matches(payload, 0, PHOTOSHOP_SIG)) {
      drop = { category: 'iptc', label: 'APP13 IPTC/Photoshop', bytes: segmentBytes };
    } else if (marker === 0xfe && opts.stripText) {
      drop = {
        category: 'text',
        label: 'COM comment',
        bytes: segmentBytes,
        detail: commentPreview(payload),
      };
    }

    if (drop) removed.push(drop);
    else parts.push(b.subarray(markerStart, segmentEnd));

    i = segmentEnd;
  }

  if (!ended) throw truncated();

  return {
    bytes: concat(parts),
    unchanged: removed.length === 0,
    removed,
    notes,
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/*  PNG                                                                       */
/* -------------------------------------------------------------------------- */

/** Key of an iTXt/tEXt chunk, when it is plain ASCII short enough to display. */
function textKeyPreview(payload: Uint8Array): string | undefined {
  let end = -1;
  for (let i = 0; i < Math.min(payload.length, 80); i++) {
    if (payload[i] === 0) {
      end = i;
      break;
    }
  }
  if (end <= 0) return undefined;
  let key = '';
  for (let i = 0; i < end; i++) {
    const c = payload[i]!;
    if (c < 0x20 || c > 0x7e) return undefined;
    key += String.fromCharCode(c);
  }
  return key ? `keyword "${key}"` : undefined;
}

/** Is this iTXt chunk the XMP packet (`XML:com.adobe.xmp` keyword)? */
function isXmpTextChunk(payload: Uint8Array): boolean {
  return matches(payload, 0, XMP_TEXT_KEY) && payload[XMP_TEXT_KEY.length] === 0;
}

/** Chunks we understand and deliberately keep (everything else ancillary is noted). */
const KNOWN_PNG_CHUNKS = new Set([
  'IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT',
  'bKGD', 'hIST', 'pHYs', 'sPLT', 'tIME', 'tEXt', 'zTXt', 'iTXt', 'eXIf', 'acTL',
  'fcTL', 'fdAT', 'cICP', 'mDCv', 'cLLi',
]);

export function stripPng(input: Uint8Array, opts: StripOptions): StripOutcome {
  if (!matches(input, 0, PNG_SIG)) {
    throw new ToolError('That file is not a valid PNG image.', 'Pick a PNG file (.png).');
  }

  const parts: Uint8Array[] = [input.subarray(0, 8)];
  const removed: RemovedSegment[] = [];
  const notes: string[] = [];
  const warnings: string[] = [];
  const truncated = (): ToolError => corrupt('That PNG is truncated or malformed.');

  let o = 8;
  let first = true;
  let sawIend = false;
  let unknownAncillary = 0;

  while (o + 8 <= input.length) {
    const len = be32(input, o);
    if (len > 0x7fffffff || o + 12 + len > input.length) throw truncated();
    const type = fourcc(input, o + 4);
    const dataStart = o + 8;
    const dataEnd = dataStart + len;
    const chunkEnd = dataEnd + 4;

    if (first && type !== 'IHDR') {
      throw new ToolError('That PNG is malformed.', 'The first chunk must be IHDR.');
    }
    first = false;

    const payload = input.subarray(dataStart, dataEnd);
    let drop: RemovedSegment | null = null;

    if (type === 'eXIf') {
      const gps = hasGpsIfd(payload);
      if (opts.stripExif || (opts.stripGps && gps)) {
        drop = {
          category: 'exif',
          label: 'PNG eXIf chunk',
          bytes: len + 12,
          detail: gps ? 'contained GPS coordinates' : undefined,
        };
        if (opts.keepOrientation && readOrientation(payload) !== undefined) {
          notes.push(
            'PNG orientation was not re-added — browsers ignore Exif orientation in PNG files.',
          );
        }
      }
    } else if (type === 'iCCP') {
      if (opts.stripIcc) {
        drop = { category: 'icc', label: 'PNG iCCP colour profile', bytes: len + 12 };
      }
    } else if (type === 'iTXt' && isXmpTextChunk(payload)) {
      if (opts.stripXmp) drop = { category: 'xmp', label: 'PNG XMP iTXt chunk', bytes: len + 12 };
    } else if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt' || type === 'tIME') {
      if (opts.stripText) {
        drop = {
          category: 'text',
          label: `${type} text chunk`,
          bytes: len + 12,
          detail: textKeyPreview(payload),
        };
      }
    } else if (!KNOWN_PNG_CHUNKS.has(type) && type.charCodeAt(0) >= 0x61) {
      unknownAncillary += 1;
    }

    if (drop) {
      // Only chunks we are about to delete are checksum-verified: kept chunks are
      // copied through byte-for-byte, so a bad CRC there cannot corrupt the output.
      if (crc32(input.subarray(o + 4, dataEnd)) !== be32(input, dataEnd)) {
        throw new ToolError(
          `That PNG appears to be corrupted (bad ${type} chunk checksum).`,
          'Re-save the image and try again.',
        );
      }
      removed.push(drop);
    } else {
      parts.push(input.subarray(o, chunkEnd));
    }

    o = chunkEnd;
    if (type === 'IEND') {
      sawIend = true;
      break;
    }
  }

  if (!sawIend) throw truncated();
  if (o < input.length) parts.push(input.subarray(o)); // trailing bytes, verbatim

  if (unknownAncillary > 0) {
    notes.push(
      `${unknownAncillary} unrecognised ancillary chunk${unknownAncillary === 1 ? '' : 's'} left untouched (they may contain extra metadata).`,
    );
  }

  return {
    bytes: concat(parts),
    unchanged: removed.length === 0,
    removed,
    notes,
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/*  WebP                                                                      */
/* -------------------------------------------------------------------------- */

// VP8X feature flags, per the WebP container spec.
const VP8X_FLAG_ICC = 0x20;
const VP8X_FLAG_EXIF = 0x08;
const VP8X_FLAG_XMP = 0x04;

export function stripWebp(input: Uint8Array, opts: StripOptions): StripOutcome {
  if (input.length < 12 || !matches(input, 0, RIFF_SIG) || !matches(input, 8, WEBP_SIG)) {
    throw new ToolError('That file is not a valid WebP image.', 'Pick a WebP file (.webp).');
  }
  const riffSize = le32(input, 4);
  if (8 + riffSize > input.length) throw corrupt('That WebP is truncated or malformed.');
  const end = 8 + riffSize;

  const chunks: Uint8Array[] = [];
  const removed: RemovedSegment[] = [];
  const notes: string[] = [];
  const warnings: string[] = [];
  let vp8xIndex = -1;
  let removedIcc = false;
  let removedExif = false;
  let removedXmp = false;

  let o = 12;
  while (o + 8 <= end) {
    const type = fourcc(input, o);
    const size = le32(input, o + 4);
    const padded = size + (size & 1);
    const chunkEnd = o + 8 + padded;
    if (o + 8 + size > input.length || chunkEnd > end) {
      throw corrupt('That WebP is truncated or malformed.');
    }
    const payload = input.subarray(o + 8, o + 8 + size);

    let drop: RemovedSegment | null = null;
    if (type === 'EXIF') {
      const gps = hasGpsIfd(payload);
      if (opts.stripExif || (opts.stripGps && gps)) {
        drop = {
          category: 'exif',
          label: 'WebP EXIF chunk',
          bytes: chunkEnd - o,
          detail: gps ? 'contained GPS coordinates' : undefined,
        };
      }
    } else if (type === 'XMP ') {
      if (opts.stripXmp) drop = { category: 'xmp', label: 'WebP XMP chunk', bytes: chunkEnd - o };
    } else if (type === 'ICCP') {
      if (opts.stripIcc) drop = { category: 'icc', label: 'WebP ICCP colour profile', bytes: chunkEnd - o };
    }

    if (type === 'VP8X') vp8xIndex = chunks.length;

    if (drop) {
      removed.push(drop);
      if (type === 'ICCP') removedIcc = true;
      else if (type === 'EXIF') removedExif = true;
      else if (type === 'XMP ') removedXmp = true;
    } else {
      chunks.push(input.subarray(o, chunkEnd));
    }
    o = chunkEnd;
  }
  if (o !== end) throw corrupt('That WebP is malformed.');

  if ((removedIcc || removedExif || removedXmp) && vp8xIndex >= 0) {
    // Repair the VP8X feature flags so readers do not look for chunks that are gone.
    const rebuilt = chunks[vp8xIndex]!.slice();
    const before = rebuilt[8]!;
    let after = before;
    if (removedIcc) after &= ~VP8X_FLAG_ICC;
    if (removedExif) after &= ~VP8X_FLAG_EXIF;
    if (removedXmp) after &= ~VP8X_FLAG_XMP;
    if (after !== before) {
      rebuilt[8] = after;
      chunks[vp8xIndex] = rebuilt;
    }
  } else if ((removedExif || removedXmp || removedIcc) && vp8xIndex < 0) {
    warnings.push('The WebP had metadata chunks but no VP8X header (non-standard container).');
  }

  const total = 12 + chunks.reduce((n, c) => n + c.length, 0);
  let out = new Uint8Array(total);
  out.set(RIFF_SIG, 0);
  writeLe32(out, 4, total - 8);
  out.set(WEBP_SIG, 8);
  let p = 12;
  for (const chunk of chunks) {
    out.set(chunk, p);
    p += chunk.length;
  }
  if (input.length > end) {
    // Preserve any trailing bytes outside the declared RIFF payload.
    const withTrailer = new Uint8Array(out.length + (input.length - end));
    withTrailer.set(out, 0);
    withTrailer.set(input.subarray(end), out.length);
    out = withTrailer;
  }

  return { bytes: out, unchanged: removed.length === 0, removed, notes, warnings };
}

/* -------------------------------------------------------------------------- */
/*  Dispatch                                                                  */
/* -------------------------------------------------------------------------- */

export function stripMetadata(
  bytes: Uint8Array,
  format: ImageFormat,
  opts: StripOptions,
): StripOutcome {
  if (format === 'jpeg') return stripJpeg(bytes, opts);
  if (format === 'png') return stripPng(bytes, opts);
  return stripWebp(bytes, opts);
}

/** Coerce resolved option values into a `StripOptions`, tolerant of omissions. */
export function toStripOptions(values: OptionValues): StripOptions {
  return {
    stripExif: values.stripExif !== false,
    stripGps: values.stripGps !== false,
    stripXmp: values.stripXmp !== false,
    stripIptc: values.stripIptc !== false,
    stripText: values.stripText !== false,
    stripIcc: values.stripIcc === true,
    keepOrientation: values.keepOrientation !== false,
  };
}

const FORMAT_LABEL: Record<ImageFormat, string> = { jpeg: 'JPEG', png: 'PNG', webp: 'WebP' };
const FORMAT_EXT: Record<ImageFormat, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' };
const FORMAT_MIME: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function uniqueName(used: Set<string>, name: string): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}${ext}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
}

function describeRemoved(removed: RemovedSegment[]): string {
  return removed
    .map((r) => `${r.label}${r.detail ? ` (${r.detail})` : ''} · ${formatBytes(r.bytes)}`)
    .join('; ');
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const opts = toStripOptions(resolveOptions(meta, input.options));
  checkFiles(input.files, true);

  const outputs: OutputFile[] = [];
  const rows: string[][] = [];
  const notes: string[] = [];
  const warnings: string[] = [];
  const usedNames = new Set<string>();
  let originalBytes = 0;
  let outputBytes = 0;
  let segmentsRemoved = 0;
  const total = input.files.length;

  if (
    !opts.stripExif &&
    !opts.stripGps &&
    !opts.stripXmp &&
    !opts.stripIptc &&
    !opts.stripText &&
    !opts.stripIcc
  ) {
    warnings.push('No metadata type is selected, so the files are copied unchanged.');
  }

  for (let i = 0; i < total; i++) {
    checkAbort(input.signal);
    const file = input.files[i]!;
    const slice = i / total;

    if (file.size > MAX_FILE_BYTES) {
      throw new ToolError(
        `"${file.name}" is too large to strip metadata from in the browser (limit ${formatBytes(MAX_FILE_BYTES)}).`,
        'Try a smaller image, or split the work into several runs.',
      );
    }

    input.onProgress?.(slice + 0.05, total > 1 ? `Reading ${file.name}` : 'Reading file');
    const bytes = new Uint8Array(await file.arrayBuffer());
    originalBytes += bytes.length;

    const format = detectFormat(bytes);
    if (!format) {
      warnings.push(`"${file.name}" is not a JPEG, PNG or WebP image, so it was skipped.`);
      rows.push([
        file.name,
        'unknown',
        'skipped — unsupported format',
        '—',
        formatBytes(bytes.length),
      ]);
      continue;
    }

    input.onProgress?.(slice + 0.5, total > 1 ? `Stripping ${file.name}` : 'Stripping metadata');
    const outcome = stripMetadata(bytes, format, opts);

    segmentsRemoved += outcome.removed.length;
    for (const note of outcome.notes) notes.push(total > 1 ? `${file.name}: ${note}` : note);
    for (const warning of outcome.warnings)
      warnings.push(total > 1 ? `${file.name}: ${warning}` : warning);

    const filename = uniqueName(usedNames, `${stem(file.name)}-clean.${FORMAT_EXT[format]}`);
    outputs.push({ filename, blob: new Blob([outcome.bytes], { type: FORMAT_MIME[format] }) });
    outputBytes += outcome.bytes.length;

    const saved = bytes.length - outcome.bytes.length;
    rows.push([
      file.name,
      FORMAT_LABEL[format],
      outcome.removed.length ? describeRemoved(outcome.removed) : 'none — already clean',
      saved >= 0 ? formatBytes(saved) : `+${formatBytes(-saved)}`,
      `${formatBytes(bytes.length)} → ${formatBytes(outcome.bytes.length)}`,
    ]);

    if (!outcome.removed.length) {
      notes.push(
        `${file.name}: no removable metadata found — the cleaned copy is byte-identical.`,
      );
    }
    for (const r of outcome.removed) {
      notes.push(
        `${file.name}: removed ${r.label}${r.detail ? ` (${r.detail})` : ''} · ${formatBytes(r.bytes)}.`,
      );
    }
  }

  if (!outputs.length) {
    throw new ToolError(
      'None of the selected files could be stripped.',
      'Lossless metadata removal supports JPEG, PNG and WebP images — convert other formats first.',
    );
  }

  input.onProgress?.(1, 'Done');
  return {
    outputs,
    report: {
      output: JSON.stringify({
        headers: ['File', 'Format', 'Removed', 'Saved', 'Size'],
        rows,
      }),
      render: 'table',
    },
    notes: notes.length ? notes : undefined,
    warnings: warnings.length ? warnings : undefined,
    stats: {
      files: outputs.length,
      segmentsRemoved,
      originalBytes,
      outputBytes,
      savedBytes: originalBytes - outputBytes,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
