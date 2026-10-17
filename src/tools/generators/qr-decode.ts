/**
 * Decoding backends for scanned codes. Worker-safe: no DOM access beyond an
 * optional `document.createElement('canvas')` fallback, and no network — the
 * only fetch is the browser's own lazy `import()` of the bundled fallback
 * decoder, which is served from this app's origin.
 *
 * Strategy (in order):
 *   1. the platform `BarcodeDetector` API, when the browser exposes it;
 *   2. `jsQR` (Apache-2.0), loaded with a dynamic `import()` the first time it
 *      is actually needed — it is never part of the initial page payload.
 *
 * `BarcodeDetector` handles a video frame directly and returns every symbol it
 * finds; jsQR works on raw RGBA pixels, so video and oversized images are first
 * rasterised onto a bounded canvas.
 */
import { ToolError } from '@/lib/types';

export interface RgbaImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface DetectedCode {
  /** Exactly what the code encodes. */
  raw: string;
  /** Detector format id, e.g. `qr_code`, `ean_13`. */
  format: string;
}

export type DecodeBackend = 'native' | 'fallback' | 'none';

export interface DecodeOptions {
  /** Requested `BarcodeDetector` formats; silently filtered to supported ones. */
  formats?: string[];
  /** Run the jsQR fallback when the native detector finds nothing. Default true. */
  tryFallback?: boolean;
  /** jsQR: also try inverted (light-on-dark) codes. Default true. */
  invert?: boolean;
  /** Longest edge used when rasterising for the fallback decoder. */
  maxEdge?: number;
}

export interface DecodeOutcome {
  codes: DetectedCode[];
  /** Which decoder produced the result (or `'none'` when nobody found a code). */
  backend: 'native' | 'fallback' | 'none';
  /** Whether the browser offers the native detector at all. */
  nativeAvailable: boolean;
}

/** Every symbol family we ask the native detector for. */
export const ALL_FORMATS = [
  'qr_code',
  'micro_qr_code',
  'data_matrix',
  'aztec',
  'pdf417',
  'code_128',
  'code_39',
  'code_93',
  'codabar',
  'ean_13',
  'ean_8',
  'itf',
  'upc_a',
  'upc_e',
] as const;

/** QR codes only — respects the "QR only" option. */
export const QR_FORMATS = ['qr_code', 'micro_qr_code'] as const;

/** Bound for rasterising an arbitrary image before the fallback decoder sees it. */
export const IMAGE_MAX_EDGE = 1600;
/** Lower bound for live camera frames: speed matters more than tiny codes. */
export const CAMERA_MAX_EDGE = 800;

/* -------------------------------------------------------------------------- */
/*  Native BarcodeDetector                                                    */
/* -------------------------------------------------------------------------- */

interface NativeDetectedBarcode {
  rawValue: string;
  format: string;
  cornerPoints?: { x: number; y: number }[];
}

interface NativeBarcodeDetector {
  detect(source: unknown): Promise<NativeDetectedBarcode[]>;
}

interface NativeBarcodeDetectorCtor {
  new (options?: { formats?: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

function nativeDetectorCtor(): NativeBarcodeDetectorCtor | undefined {
  const ctor = (globalThis as { BarcodeDetector?: NativeBarcodeDetectorCtor }).BarcodeDetector;
  return typeof ctor === 'function' ? ctor : undefined;
}

/** True when the browser exposes the native (on-device) barcode detector. */
export function nativeDetectorAvailable(): boolean {
  return nativeDetectorCtor() !== undefined;
}

function dedupe(codes: DetectedCode[]): DetectedCode[] {
  const seen = new Set<string>();
  const out: DetectedCode[] = [];
  for (const code of codes) {
    const key = `${code.format}\u0000${code.raw}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(code);
  }
  return out;
}

async function resolveFormats(
  ctor: NativeBarcodeDetectorCtor,
  requested: string[],
): Promise<string[] | undefined> {
  if (typeof ctor.getSupportedFormats !== 'function')
    return requested.length ? requested : undefined;
  try {
    const supported = await ctor.getSupportedFormats();
    const usable = requested.filter((f) => supported.includes(f));
    return usable.length ? usable : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Run the native detector. Returns `null` when the API is unavailable, `[]` when
 * it ran but found nothing.
 */
async function detectNative(source: unknown, requested: string[]): Promise<DetectedCode[] | null> {
  const ctor = nativeDetectorCtor();
  if (!ctor) return null;
  const formats = await resolveFormats(ctor, requested);
  let detector: NativeBarcodeDetector;
  try {
    detector = formats ? new ctor({ formats }) : new ctor();
  } catch {
    // Some implementations reject format lists they don't recognise.
    detector = new ctor();
  }
  const found = await detector.detect(source);
  return dedupe(
    (found ?? []).map((c) => ({ raw: String(c.rawValue ?? ''), format: String(c.format ?? '') })),
  );
}

/* -------------------------------------------------------------------------- */
/*  Canvas rasterisation                                                      */
/* -------------------------------------------------------------------------- */

interface DrawableSource {
  width?: number;
  height?: number;
  videoWidth?: number;
  videoHeight?: number;
}

function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new ToolError(
    'This browser cannot analyse image pixels.',
    'Codes in uploaded images need canvas support. Try a recent Chrome, Edge, Firefox or Safari.',
  );
}

function context2d(
  canvas: OffscreenCanvas | HTMLCanvasElement,
): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null {
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    return canvas.getContext('2d', { willReadFrequently: true });
  }
  return (canvas as HTMLCanvasElement).getContext('2d', { willReadFrequently: true });
}

/**
 * Draw `source` onto a size-bounded canvas and read back RGBA pixels — the
 * input shape jsQR wants. Images are never upscaled.
 */
export function rasterizeToRgba(source: unknown, maxEdge = IMAGE_MAX_EDGE): RgbaImage {
  const dims = source as DrawableSource;
  const sw = Number(dims?.videoWidth || dims?.width || 0);
  const sh = Number(dims?.videoHeight || dims?.height || 0);
  if (!sw || !sh) {
    throw new ToolError(
      'The image had no readable dimensions.',
      'Try a different PNG, JPEG or WebP file.',
    );
  }
  const limit = Math.max(64, maxEdge);
  const scale = Math.min(1, limit / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));

  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  if (!ctx) {
    throw new ToolError(
      'This browser could not create a drawing context.',
      'Try a recent Chrome, Edge, Firefox or Safari.',
    );
  }
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  return { data: image.data, width: image.width, height: image.height };
}

/* -------------------------------------------------------------------------- */
/*  jsQR fallback                                                             */
/* -------------------------------------------------------------------------- */

type JsQrResult = { data: string } | null;
type JsQrFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' },
) => JsQrResult;

let jsqrPromise: Promise<JsQrFn> | undefined;

/**
 * Lazy-load the fallback decoder. The chunk is served from this app's own
 * origin (never a CDN) and is only requested when the native detector is
 * missing or has already missed.
 */
export function loadJsQr(): Promise<JsQrFn> {
  jsqrPromise ??= (async () => {
    const mod = (await import('jsqr')) as unknown as JsQrFn | { default?: JsQrFn };
    const fn = typeof mod === 'function' ? mod : mod.default;
    if (typeof fn !== 'function') throw new ToolError('The bundled QR decoder failed to load.');
    return fn;
  })();
  return jsqrPromise;
}

/** True once the fallback chunk has been requested. */
export function fallbackDecoderLoading(): boolean {
  return jsqrPromise !== undefined;
}

async function detectJsQr(image: RgbaImage, invert: boolean): Promise<DetectedCode[]> {
  if (image.width < 1 || image.height < 1) return [];
  const jsQR = await loadJsQr();
  const found = jsQR(image.data, image.width, image.height, {
    inversionAttempts: invert ? 'attemptBoth' : 'dontInvert',
  });
  return found ? [{ raw: found.data, format: 'qr_code' }] : [];
}

/* -------------------------------------------------------------------------- */
/*  Public entry points                                                       */
/* -------------------------------------------------------------------------- */

function normaliseOpts(opts: DecodeOptions): {
  formats: string[];
  tryFallback: boolean;
  invert: boolean;
  maxEdge: number;
} {
  return {
    formats: opts.formats?.length ? opts.formats : [...ALL_FORMATS],
    tryFallback: opts.tryFallback !== false,
    invert: opts.invert !== false,
    maxEdge: opts.maxEdge ?? IMAGE_MAX_EDGE,
  };
}

/**
 * Decode every code in `source` (an `ImageBitmap`, `OffscreenCanvas`,
 * `HTMLCanvasElement`, `HTMLVideoElement` or `ImageData`).
 *
 * jsQR is only asked when it can help: the native detector either is missing, or
 * ran and found nothing while `tryFallback` is on. Multiple codes are returned
 * when the native detector (or a future backend) reports them.
 */
export async function detectCodes(
  source: unknown,
  opts: DecodeOptions = {},
): Promise<DecodeOutcome> {
  const o = normaliseOpts(opts);
  const native = await detectNative(source, o.formats);
  if (native && native.length) {
    return { codes: native, backend: 'native', nativeAvailable: true };
  }
  if (native === null && !o.tryFallback) {
    throw new ToolError(
      'This browser has no built-in barcode detector.',
      'Turn on “Use the fallback decoder” to decode images in software instead.',
    );
  }
  if (native === null || o.tryFallback) {
    const rgba = rasterizeToRgba(source, o.maxEdge);
    const codes = await detectJsQr(rgba, o.invert);
    if (codes.length) return { codes, backend: 'fallback', nativeAvailable: native !== null };
  }
  return { codes: [], backend: native ? 'native' : 'none', nativeAvailable: native !== null };
}

/**
 * Decode every code in an already-rasterised image. Used by tests and by
 * callers that keep their own pixel buffer.
 */
export async function detectCodesInRgba(
  image: RgbaImage,
  opts: DecodeOptions = {},
): Promise<DecodeOutcome> {
  const o = normaliseOpts(opts);
  const ctor = nativeDetectorCtor();
  if (ctor && typeof ImageData === 'function') {
    // Copy into a fresh typed array so the buffer type matches what ImageData wants.
    const pixels = new Uint8ClampedArray(image.data);
    const native = await detectNative(new ImageData(pixels, image.width, image.height), o.formats);
    if (native && native.length) {
      return { codes: native, backend: 'native', nativeAvailable: true };
    }
  }
  if (!ctor && !o.tryFallback) {
    throw new ToolError(
      'This browser has no built-in barcode detector.',
      'Turn on “Use the fallback decoder” to decode images in software instead.',
    );
  }
  if (o.tryFallback) {
    const codes = await detectJsQr(image, o.invert);
    if (codes.length) return { codes, backend: 'fallback', nativeAvailable: ctor !== undefined };
  }
  return { codes: [], backend: 'none', nativeAvailable: ctor !== undefined };
}

/* -------------------------------------------------------------------------- */
/*  Friendly errors                                                          */
/* -------------------------------------------------------------------------- */

/** Turn a `getUserMedia` rejection into a user-facing ToolError. */
export function describeCameraError(err: unknown): ToolError {
  const e = err as { name?: string; message?: string } | undefined;
  switch (e?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return new ToolError(
        'Camera permission was denied.',
        'Allow camera access for this site — open the padlock in the address bar, set Camera to “Allow”, then press Start camera again. You can also scan an image below; no camera needed.',
      );
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return new ToolError(
        'No camera was found on this device.',
        'Check that a camera is connected and not disabled in your system settings, or scan an image below.',
      );
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new ToolError(
        'The camera is already in use.',
        'Close other apps or tabs that are using the camera (video calls, other tabs), then press Start camera again.',
      );
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return new ToolError(
        'This camera does not support the requested settings.',
        'Press Start camera again to retry with the default camera.',
      );
    case 'SecurityError':
      return new ToolError(
        'Camera access is blocked on this page.',
        'Browsers only allow cameras on secure pages — open this tool over https:// (or localhost), then try again.',
      );
    case 'TypeError':
      return new ToolError(
        'This browser does not expose a camera API.',
        'Camera access needs a recent Chrome, Edge, Firefox or Safari. You can still scan an uploaded image below.',
      );
    default:
      return new ToolError(
        e?.message || 'The camera could not be started.',
        'You can still scan an uploaded image below — nothing is ever uploaded.',
      );
  }
}
