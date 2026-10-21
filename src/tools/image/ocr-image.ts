/**
 * Pure image helpers for the OCR tool: recognise an image format from its
 * first bytes, read its dimensions straight out of the header, and decide
 * whether the browser can run the Tesseract WebAssembly core.
 *
 * Reading the size from the header (rather than decoding the image first)
 * means an enormous photo is refused before it can exhaust the tab's memory.
 */
import { ToolError } from '@/lib/types';

export type OcrImageFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'bmp';

/** Image formats the tool accepts. Tesseract reads all of them. */
export const OCR_IMAGE_FORMATS: readonly OcrImageFormat[] = ['png', 'jpeg', 'webp', 'gif', 'bmp'];

/** Human-readable format names for error messages. */
export const OCR_IMAGE_FORMAT_LABELS: Record<OcrImageFormat, string> = {
  png: 'PNG',
  jpeg: 'JPEG',
  webp: 'WebP',
  gif: 'GIF',
  bmp: 'BMP',
};

/** Largest file the tool will look at. */
export const MAX_OCR_FILE_BYTES = 20 * 1024 * 1024;
/** Largest number of pixels the tool will decode (a 12 MP photo is ~4 000×3 000). */
export const MAX_OCR_PIXELS = 16_000_000;
/** Largest single side the tool will decode. */
export const MAX_OCR_EDGE = 12_000;

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += String.fromCharCode(bytes[offset + i] ?? 0);
  return out;
}

/** Work out which image format a file is, from its magic bytes. */
export function sniffImageFormat(bytes: Uint8Array): OcrImageFormat | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  if (startsWith(bytes, [0x42, 0x4d])) return 'bmp';
  if (startsWith(bytes, asciiBytes('RIFF')) && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
  return null;
}

function asciiBytes(text: string): number[] {
  return [...text].map((c) => c.charCodeAt(0));
}

function be16(bytes: Uint8Array, at: number): number {
  return ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);
}

function be32(bytes: Uint8Array, at: number): number {
  return (
    ((bytes[at] ?? 0) * 0x1000000 +
      ((bytes[at + 1] ?? 0) << 16) +
      ((bytes[at + 2] ?? 0) << 8) +
      (bytes[at + 3] ?? 0)) >>>
    0
  );
}

function le16(bytes: Uint8Array, at: number): number {
  return (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
}

function le32(bytes: Uint8Array, at: number): number {
  return (
    ((bytes[at] ?? 0) |
      ((bytes[at + 1] ?? 0) << 8) |
      ((bytes[at + 2] ?? 0) << 16) |
      ((bytes[at + 3] ?? 0) << 24)) >>>
    0
  );
}

function le24(bytes: Uint8Array, at: number): number {
  return (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8) | ((bytes[at + 2] ?? 0) << 16);
}

/** Read the pixel size out of a PNG header. */
function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (ascii(bytes, 12, 4) !== 'IHDR') return null;
  return { width: be32(bytes, 16), height: be32(bytes, 20) };
}

/** Read the pixel size out of a JPEG's frame header. */
function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) {
      at += 1;
      continue;
    }
    const marker = bytes[at + 1] ?? 0;
    // Standalone markers carry no payload.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      at += 2;
      continue;
    }
    const length = be16(bytes, at + 2);
    const isFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) return { width: be16(bytes, at + 7), height: be16(bytes, at + 5) };
    if (marker === 0xda) return null; // start of scan: no frame header before it
    if (length < 2) return null;
    at += 2 + length;
  }
  return null;
}

/** Read the pixel size out of a GIF header. */
function gifSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 10) return null;
  return { width: le16(bytes, 6), height: le16(bytes, 8) };
}

/** Read the pixel size out of a BMP header. */
function bmpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 26) return null;
  return { width: le32(bytes, 18), height: Math.abs(le32(bytes, 22)) };
}

/** Read the pixel size out of a WebP header (VP8X, VP8L or lossy VP8). */
function webpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === 'VP8X') {
    return { width: le24(bytes, 24) + 1, height: le24(bytes, 27) + 1 };
  }
  if (chunk === 'VP8L') {
    const bits = le32(bytes, 21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8 ') {
    // Lossy: 3-byte frame tag, 3-byte sync code, then two 14-bit dimensions.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return { width: le16(bytes, 26) & 0x3fff, height: le16(bytes, 28) & 0x3fff };
  }
  return null;
}

/**
 * The pixel size of an image, read from its header. Returns `null` when the
 * size cannot be found — the caller then falls back to the decoded size.
 */
export function readImageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const format = sniffImageFormat(bytes);
  if (!format) return null;
  switch (format) {
    case 'png':
      return pngSize(bytes);
    case 'jpeg':
      return jpegSize(bytes);
    case 'webp':
      return webpSize(bytes);
    case 'gif':
      return gifSize(bytes);
    case 'bmp':
      return bmpSize(bytes);
  }
}

/** Refuse an image that is too big to OCR safely. */
export function assertOcrImageSize(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new ToolError('That file does not contain a readable image.');
  }
  if (width > MAX_OCR_EDGE || height > MAX_OCR_EDGE || width * height > MAX_OCR_PIXELS) {
    throw new ToolError(
      `That image is too large to read (${width}×${height} pixels).`,
      `The limit is ${MAX_OCR_PIXELS.toLocaleString('en-GB')} pixels and ${MAX_OCR_EDGE.toLocaleString('en-GB')} px per side. Resize it first, then try again.`,
    );
  }
}

/** Refuse a file that is too big to load at all. */
export function assertOcrFileSize(bytes: number, name: string): void {
  if (bytes > MAX_OCR_FILE_BYTES) {
    const mb = Math.round(MAX_OCR_FILE_BYTES / 1024 / 1024);
    throw new ToolError(
      `“${name}” is too large to read (${Math.round(bytes / 1024 / 1024)} MB).`,
      `The limit is ${mb} MB per image. Resize it first, then try again.`,
    );
  }
}

/**
 * A tiny WebAssembly module that uses the SIMD instructions. Validating it
 * tells us whether the browser can run the accelerated Tesseract core.
 */
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15,
  253, 98, 11,
]);

/** True when the browser's WebAssembly engine supports SIMD. */
export function supportsSimd(): boolean {
  try {
    return WebAssembly.validate(SIMD_PROBE);
  } catch {
    return false;
  }
}
