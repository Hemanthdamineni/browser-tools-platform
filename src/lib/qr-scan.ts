/**
 * QR decoding — entirely on-device.
 *
 * Prefers the browser's own `BarcodeDetector` (Chromium, and Safari/Firefox
 * where it is exposed) and falls back to a pure-JS decoder (jsQR, Apache-2.0)
 * that is imported lazily on first use, so browsers with a native detector
 * never download it.
 *
 * Worker-safe: pixels come from `OffscreenCanvas` when available and a DOM
 * canvas otherwise. Nothing here talks to the network, and no data leaves the
 * device.
 */
import { ToolError } from './types';
import { decodeImage } from './image';

export interface PixelImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** One decoded code. `source` records which decoder produced it. */
export interface DecodedCode {
  text: string;
  source: 'native' | 'jsqr';
}

export interface DecodeOptions {
  /** Rotate and try both polarities when the first pass finds nothing. */
  tryHarder?: boolean;
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

export interface ScanImageOptions extends DecodeOptions {
  /** Longest edge to scan, in pixels. Larger images are downscaled first. */
  maxDimension?: number;
}

export interface ScanImageResult {
  codes: DecodedCode[];
  /** Dimensions of the source image. */
  width: number;
  height: number;
  /** Dimensions actually scanned (after downscaling). */
  scannedWidth: number;
  scannedHeight: number;
}

/** Default longest edge handed to the decoder. */
export const DEFAULT_MAX_DIMENSION = 2048;
export const MIN_MAX_DIMENSION = 256;
export const MAX_MAX_DIMENSION = 8192;
/** Refuse anything larger than this up front — a 80 MP RGBA bitmap is ~320 MB. */
export const MAX_PIXELS = 80_000_000;
/** Refuse absurdly large files before handing them to the image decoder. */
export const MAX_BYTES = 96 * 1024 * 1024;

/** Minimal 2D context surface shared by DOM and offscreen canvases. */
interface Pixels2D {
  drawImage(
    source: CanvasImageSource,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  getImageData(sx: number, sy: number, sw: number, sh: number): {
    data: Uint8ClampedArray;
    width: number;
    height: number;
  };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('The operation was cancelled.', 'AbortError');
}

export function isAbortError(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'AbortError';
}

export function clampMaxDimension(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MAX_DIMENSION;
  return Math.min(MAX_MAX_DIMENSION, Math.max(MIN_MAX_DIMENSION, Math.round(value)));
}

/* -------------------------------------------------------------------------- */
/*  Canvas → pixels                                                           */
/* -------------------------------------------------------------------------- */

function context2d(width: number, height: number): Pixels2D {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) return ctx as unknown as Pixels2D;
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) return ctx as unknown as Pixels2D;
  }
  throw new ToolError(
    'Your browser could not read the image pixels.',
    'Try a recent Chrome, Edge, Firefox or Safari, or update your browser.',
  );
}

/**
 * Draw `source` into a canvas (downscaling so the longest edge is at most
 * `maxDimension`) and return its RGBA pixels.
 */
export function pixelsFromSource(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxDimension: number,
): PixelImage {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const scale = Math.min(1, maxDimension / Math.max(w, h));
  const targetW = Math.max(1, Math.round(w * scale));
  const targetH = Math.max(1, Math.round(h * scale));
  const ctx = context2d(targetW, targetH);
  ctx.drawImage(source, 0, 0, targetW, targetH);
  const { data } = ctx.getImageData(0, 0, targetW, targetH);
  return { data, width: targetW, height: targetH };
}

/* -------------------------------------------------------------------------- */
/*  Native BarcodeDetector                                                    */
/* -------------------------------------------------------------------------- */

interface NativeDetectedBarcode {
  rawValue?: string;
  rawData?: string;
}
interface NativeBarcodeDetector {
  detect(source: ImageData): Promise<NativeDetectedBarcode[]>;
}
interface NativeBarcodeDetectorCtor {
  new (options?: { formats?: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

let nativeDetector: Promise<NativeBarcodeDetector | null> | null = null;

/**
 * Test seam: forget the cached capability probe. Unit tests stub
 * `BarcodeDetector`, and the probe result is cached per page load.
 */
export function resetNativeDetectorCache(): void {
  nativeDetector = null;
}

function getNativeDetector(): Promise<NativeBarcodeDetector | null> {
  nativeDetector ??= (async () => {
    const ctor = (globalThis as { BarcodeDetector?: NativeBarcodeDetectorCtor })
      .BarcodeDetector;
    if (!ctor || typeof ImageData === 'undefined') return null;
    try {
      if (ctor.getSupportedFormats) {
        const formats = await ctor.getSupportedFormats();
        if (Array.isArray(formats) && formats.length && !formats.includes('qr_code')) return null;
      }
      return new ctor({ formats: ['qr_code'] });
    } catch {
      return null; // present but unusable — fall through to the JS decoder
    }
  })();
  return nativeDetector;
}

async function detectNative(image: PixelImage): Promise<DecodedCode[]> {
  const detector = await getNativeDetector();
  if (!detector) return [];
  try {
    const source = new ImageData(image.data, image.width, image.height);
    const results = await detector.detect(source);
    return results
      .map((r) => r.rawValue ?? r.rawData ?? '')
      .filter((text) => text.length > 0)
      .map((text) => ({ text, source: 'native' as const }));
  } catch {
    return []; // misbehaving detector — the JS decoder still gets a turn
  }
}

/* -------------------------------------------------------------------------- */
/*  jsQR fallback (lazy)                                                      */
/* -------------------------------------------------------------------------- */

type JsQrFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' },
) => { data: string } | null;

function pickCallable(value: unknown): JsQrFn | undefined {
  if (typeof value === 'function') return value as JsQrFn;
  const nested = (value as { default?: unknown } | null)?.default;
  return typeof nested === 'function' ? (nested as JsQrFn) : undefined;
}

/** Import the bundled fallback decoder. Cached by the module registry. */
async function loadJsQr(): Promise<JsQrFn> {
  let mod: unknown;
  try {
    mod = await import('jsqr');
  } catch {
    throw new ToolError(
      'The QR decoder could not be loaded.',
      'Check your connection for the first run, then try again.',
    );
  }
  const fn = pickCallable(mod) ?? pickCallable((mod as { default?: unknown }).default);
  if (!fn) {
    throw new ToolError(
      'The QR decoder could not be loaded.',
      'Please reload the page and try again.',
    );
  }
  return fn;
}

async function detectWithJsQr(image: PixelImage, tryHarder: boolean): Promise<DecodedCode[]> {
  const jsQR = await loadJsQr();
  const result = jsQR(image.data, image.width, image.height, {
    inversionAttempts: tryHarder ? 'attemptBoth' : 'dontInvert',
  });
  return result?.data ? [{ text: result.data, source: 'jsqr' }] : [];
}

/* -------------------------------------------------------------------------- */
/*  Public entry points                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Decode a QR code from raw RGBA pixels. Native detector first, bundled JS
 * decoder as a fallback. Both locate codes at any rotation, so no rotated
 * passes are needed; `tryHarder` instead adds an inverted (white-on-black)
 * attempt, which the JS fallback only performs when asked.
 *
 * Returns the codes found (possibly none).
 */
export async function decodePixels(
  image: PixelImage,
  options: DecodeOptions = {},
): Promise<DecodedCode[]> {
  const tryHarder = options.tryHarder ?? true;
  throwIfAborted(options.signal);
  options.onProgress?.(0.2, 'Looking for a code');

  let codes = await detectNative(image);
  if (!codes.length) codes = await detectWithJsQr(image, tryHarder);

  throwIfAborted(options.signal);
  options.onProgress?.(1, codes.length ? 'Code found' : 'No code found');
  return codes;
}

/**
 * Decode a QR code from an uploaded image Blob. Guards against images too large
 * to decode safely and reports friendly errors for unreadable files.
 */
export async function scanImageBlob(
  blob: Blob,
  options: ScanImageOptions = {},
): Promise<ScanImageResult> {
  throwIfAborted(options.signal);
  if (blob.size > MAX_BYTES) {
    throw new ToolError(
      `That file is ${(blob.size / (1024 * 1024)).toFixed(0)} MB — too large to scan safely.`,
      'Export a smaller copy of the image, or crop it around the code.',
    );
  }

  const bitmap = await decodeImage(blob);
  try {
    throwIfAborted(options.signal);
    const pixels = bitmap.width * bitmap.height;
    if (pixels > MAX_PIXELS) {
      throw new ToolError(
        `That image is ${(pixels / 1_000_000).toFixed(1)} megapixels — too large to scan safely.`,
        'Resize it first, or take a fresh screenshot of just the code.',
      );
    }
    const maxDimension = clampMaxDimension(options.maxDimension ?? DEFAULT_MAX_DIMENSION);
    const scanned = pixelsFromSource(bitmap, bitmap.width, bitmap.height, maxDimension);
    options.onProgress?.(0.05, 'Looking for a code');
    const codes = await decodePixels(scanned, options);
    return {
      codes,
      width: bitmap.width,
      height: bitmap.height,
      scannedWidth: scanned.width,
      scannedHeight: scanned.height,
    };
  } finally {
    bitmap.close();
  }
}
