/**
 * Shared helpers for the batch image tools (compress / convert / resize / crop).
 *
 * Deliberately kept in a new module rather than editing `src/lib/image.ts` or
 * `./common.ts` — those are owned by separate workstreams. Everything here is
 * pure except the canvas/bitmap calls, and every failure path raises a friendly
 * `ToolError` instead of crashing the tab.
 */
import { ToolError } from '@/lib/types';

/** Practical per-side canvas limit shared by all major browsers (~16k px). */
export const MAX_CANVAS_EDGE = 16_384;
/** Pixel budget: refuse anything above this so a huge image cannot crash the tab. */
export const MAX_CANVAS_PIXELS = 100_000_000;

const UNSUPPORTED = 'Try a recent Chrome, Edge, Firefox or Safari.';

/**
 * Guard a canvas/bitmap size against browser limits. Called both for the
 * decoded source (a huge decode is what usually exhausts memory) and for the
 * output canvas (e.g. an aggressive upscale).
 */
export function assertCanvasBudget(width: number, height: number, label = 'image'): void {
  const w = Math.round(width);
  const h = Math.round(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) {
    throw new ToolError(`The ${label} has no measurable size.`);
  }
  if (w > MAX_CANVAS_EDGE || h > MAX_CANVAS_EDGE || w * h > MAX_CANVAS_PIXELS) {
    throw new ToolError(
      `That ${label} is too large to process safely (${w}×${h} pixels).`,
      `The limit is ${MAX_CANVAS_PIXELS.toLocaleString()} pixels and ${MAX_CANVAS_EDGE.toLocaleString()} px per side. Resize it first, then try again.`,
    );
  }
}

/** Create a fresh OffscreenCanvas after enforcing the pixel budget. */
export function createCanvas(width: number, height: number, label = 'output'): OffscreenCanvas {
  assertCanvasBudget(width, height, label);
  if (typeof OffscreenCanvas === 'undefined') {
    throw new ToolError('Your browser does not support OffscreenCanvas.', UNSUPPORTED);
  }
  return new OffscreenCanvas(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
}

/** Get a 2D context, or fail with a friendly message. */
export function context2d(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ToolError('Your browser could not create a 2D drawing context.', UNSUPPORTED);
  return ctx;
}

/**
 * Decode a Blob into an ImageBitmap, honouring EXIF orientation when the
 * browser supports it. We ask for `imageOrientation: 'from-image'` explicitly so
 * phone photos are not sideways. If the engine rejects the option bag we fall
 * back to a plain decode rather than guessing an angle and flipping wrongly.
 */
export async function decodeOriented(blob: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== 'function') {
    throw new ToolError('Your browser does not support createImageBitmap.', UNSUPPORTED);
  }
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    // Older engines throw when handed an options bag — retry with defaults.
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

/** True when a canvas-encodable format keeps an alpha channel. */
export function keepsAlpha(mime: string): boolean {
  return mime !== 'image/jpeg';
}

/**
 * JPEG has no alpha channel, so transparent pixels must be flattened onto a
 * solid colour first. PNG / WebP / AVIF keep transparency, so this is a no-op
 * for them.
 */
export function flattenForJpeg(
  ctx: OffscreenCanvasRenderingContext2D,
  mime: string,
  width: number,
  height: number,
  background = '#ffffff',
): void {
  if (keepsAlpha(mime)) return;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
}

/** Encode a canvas, failing with a friendly message when the format is unsupported. */
export async function encodeCanvas(canvas: OffscreenCanvas, mime: string, quality?: number): Promise<Blob> {
  const blob = await canvas.convertToBlob({ type: mime, quality });
  if (blob.type !== mime) {
    const label = mime.replace('image/', '').toUpperCase();
    throw new ToolError(
      `This browser cannot encode ${label} images.`,
      'Try PNG or WebP, which every modern browser supports.',
    );
  }
  return blob;
}

export interface BatchEnv {
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

/** Throw an AbortError when the caller has cancelled. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('The operation was cancelled.', 'AbortError');
}

/**
 * Process every file in order, reporting progress and honouring cancellation.
 * Results come back in input order so callers can map them 1:1.
 */
export async function runBatch<T>(
  files: File[],
  env: BatchEnv,
  verb: string,
  process: (file: File, index: number) => Promise<T>,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < files.length; i++) {
    throwIfAborted(env.signal);
    const file = files[i]!;
    env.onProgress?.(i / files.length, `${verb} ${file.name}`);
    out.push(await process(file, i));
  }
  env.onProgress?.(1, 'Done');
  return out;
}
