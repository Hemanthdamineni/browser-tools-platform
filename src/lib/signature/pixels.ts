/**
 * Pure pixel / byte helpers for signatures.
 *
 * Nothing here touches the DOM, so it runs in a browser tab, in a Web Worker
 * and in Vitest alike.
 */

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_IHDR = 0x49484452; // 'IHDR'

/** True when `bytes` start with the 8-byte PNG signature. */
export function isPngBytes(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_MAGIC.length) return false;
  return PNG_MAGIC.every((byte, index) => bytes[index] === byte);
}

export interface PngInfo {
  /** Pixel width declared in the IHDR chunk. */
  width: number;
  /** Pixel height declared in the IHDR chunk. */
  height: number;
  /** Bits per channel (8 for every PNG we produce or accept). */
  bitDepth: number;
  /** PNG colour type: 0 grey, 2 RGB, 3 palette, 4 grey+alpha, 6 RGBA. */
  colorType: number;
  /** True when the file carries an alpha channel (4 or 6). */
  hasAlpha: boolean;
}

/**
 * Read a PNG's intrinsic size and colour type from its IHDR chunk.
 * Returns `null` for anything that is not a well-formed PNG.
 */
export function readPngInfo(bytes: Uint8Array): PngInfo | null {
  if (!isPngBytes(bytes)) return null;
  // 8 signature + 4 length + 4 type + 13 IHDR payload = 29 bytes minimum.
  if (bytes.length < 29) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(12) !== PNG_IHDR) return null;
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  const bitDepth = bytes[24] ?? 8;
  const colorType = bytes[25] ?? 0;
  if (!width || !height) return null;
  return { width, height, bitDepth, colorType, hasAlpha: colorType === 4 || colorType === 6 };
}

export interface DecodedDataUrl {
  /** Lower-cased MIME type, e.g. `image/png`. */
  mime: string;
  /** The decoded payload. */
  bytes: Uint8Array;
}

/**
 * Decode a `data:` URL into its MIME type and bytes.
 *
 * Only base64 payloads are supported — that is what `canvas.toDataURL()` and
 * `FileReader.readAsDataURL()` produce, and it keeps binary data intact.
 */
export function decodeDataUrl(dataUrl: string): DecodedDataUrl {
  const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)(;[^,]*)?,([\s\S]*)$/i.exec(
    String(dataUrl ?? '').trim(),
  );
  if (!match) throw new Error('Not a data URL.');
  const mime = match[1]!.toLowerCase();
  const parameters = match[2] ?? '';
  if (!/;base64/i.test(parameters)) throw new Error('Only base64 data URLs are supported.');
  const payload = (match[3] ?? '').replace(/\s+/g, '');
  let binary: string;
  try {
    binary = atob(payload);
  } catch {
    throw new Error('The data URL payload is not valid base64.');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { mime, bytes };
}

/** Encode bytes as a base64 `data:` URL. */
export function bytesToDataUrl(mime: string, bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Bounding box of every pixel whose alpha is above `threshold`.
 * Returns `null` when the image is completely transparent.
 */
export function trimAlpha(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  threshold = 8,
): PixelRect | null {
  if (width <= 0 || height <= 0) return null;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const alpha = data[(row + x) * 4 + 3] ?? 0;
      if (alpha <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
