/**
 * Canvas helpers used by the E4 image tools. Worker-safe: they use
 * `OffscreenCanvas` + `createImageBitmap` and fall back to a friendly
 * `ToolError` when the browser lacks them. No DOM access; pixel paths are
 * exercised by e2e (E5), unit tests cover the guards.
 */
import { ToolError } from './types';

const UNSUPPORTED_HINT = 'Try a recent Chrome, Edge, Firefox or Safari.';

/** Create a fresh OffscreenCanvas, or throw a user-facing ToolError. */
export function canvasFor(width: number, height: number): OffscreenCanvas {
  if (typeof OffscreenCanvas === 'undefined') {
    throw new ToolError('Your browser does not support OffscreenCanvas.', UNSUPPORTED_HINT);
  }
  return new OffscreenCanvas(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
}

/** Decode an image Blob into an ImageBitmap. */
export async function decodeImage(blob: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== 'function') {
    throw new ToolError('Your browser does not support createImageBitmap.', UNSUPPORTED_HINT);
  }
  try {
    return await createImageBitmap(blob);
  } catch {
    throw new ToolError(
      'That file could not be decoded as an image.',
      'Check that it is a valid PNG, JPEG, WebP, GIF or BMP file.',
    );
  }
}

type DrawableSource = ImageBitmap | OffscreenCanvas | HTMLCanvasElement;

/** Draw `source` (optionally rescaled) and export it as an encoded Blob. */
export async function drawToBlob(
  source: DrawableSource,
  opts: { width?: number; height?: number; type?: string; quality?: number } = {},
): Promise<Blob> {
  const width = opts.width ?? source.width;
  const height = opts.height ?? source.height;
  const canvas = canvasFor(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new ToolError('Your browser could not create a 2D drawing context.', UNSUPPORTED_HINT);
  }
  ctx.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  const type = opts.type ?? 'image/png';
  return canvas.convertToBlob({ type, quality: opts.quality });
}

/**
 * Downscale-sample an image into a flat RGBA pixel array for analysis
 * (palette extraction, dominant colour, brightness stats). Sampling is
 * capped so huge images don't blow memory: at most ~`maxSample` pixels are
 * read.
 */
export function readPixels(source: DrawableSource, maxSample = 100_000): Uint8ClampedArray {
  const scale = Math.min(1, Math.sqrt(maxSample / (source.width * source.height)));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const canvas = canvasFor(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new ToolError('Your browser could not create a 2D drawing context.', UNSUPPORTED_HINT);
  }
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}
