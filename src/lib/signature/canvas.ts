/**
 * Browser-only canvas helpers shared by the signature sources.
 *
 * The canvas is always kept **transparent** — the ink is what the user drew or
 * typed, everything else stays alpha 0 so the signature can be dropped on any
 * page colour.
 */
import { trimAlpha } from './pixels';

/** Get a 2D context or fail with a message a user can act on. */
export function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser does not provide a 2D canvas context.');
  return ctx;
}

export interface InkBox {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Crop a canvas down to the ink it contains and export it as a PNG data URL.
 * Returns `null` when the canvas is completely transparent.
 */
export function cropToInk(canvas: HTMLCanvasElement): InkBox | null {
  const width = canvas.width;
  const height = canvas.height;
  if (!width || !height) return null;
  const ctx = get2d(canvas);
  const image = ctx.getImageData(0, 0, width, height);
  const box = trimAlpha(image.data, width, height);
  if (!box) return null;

  const out = document.createElement('canvas');
  out.width = box.width;
  out.height = box.height;
  const outCtx = get2d(out);
  // `putImageData` ignores transforms, so the offset is done by the coordinates.
  outCtx.putImageData(image, -box.x, -box.y);
  return { dataUrl: out.toDataURL('image/png'), width: box.width, height: box.height };
}

/** Scale a box so its longest side is at most `max` pixels. */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  if (!width || !height) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
