/**
 * The drawing pad: a pointer-driven canvas that turns freehand strokes into a
 * transparent PNG signature.
 *
 * The backing store is a fixed high resolution (independent of the size the
 * pad is displayed at), so the exported signature stays crisp when it is
 * scaled onto a PDF page.
 */
import { cropToInk, get2d } from './canvas';
import type { SignatureAsset } from './types';

export interface SignaturePadOptions {
  /** Backing-store width in pixels. */
  width?: number;
  /** Backing-store height in pixels. */
  height?: number;
  /** Stroke colour. */
  ink?: string;
  /** Stroke width in backing-store pixels. */
  lineWidth?: number;
  /** Called whenever ink is added or cleared. */
  onChange?: (hasInk: boolean) => void;
}

export interface SignaturePad {
  /** Remove every stroke. */
  clear(): void;
  /** True when nothing has been drawn yet. */
  isEmpty(): boolean;
  /** The trimmed signature, or `null` while the pad is empty. */
  toAsset(): SignatureAsset | null;
  /** Detach the pointer listeners. */
  destroy(): void;
}

interface Point {
  x: number;
  y: number;
}

/** Default backing store — 1600×480 keeps a signature sharp at ~2.5× print size. */
export const PAD_WIDTH = 1600;
export const PAD_HEIGHT = 480;

/**
 * Attach a drawing pad to `canvas`.
 *
 * Pointer events cover mouse, pen and touch with a single code path; the pen's
 * pressure is deliberately ignored so the stroke weight stays predictable.
 */
export function createSignaturePad(
  canvas: HTMLCanvasElement,
  options: SignaturePadOptions = {},
): SignaturePad {
  const width = Math.max(1, Math.round(options.width ?? PAD_WIDTH));
  const height = Math.max(1, Math.round(options.height ?? PAD_HEIGHT));
  const ink = options.ink ?? '#111827';
  const lineWidth = Math.max(1, options.lineWidth ?? Math.max(2, Math.round(height / 90)));

  canvas.width = width;
  canvas.height = height;
  const ctx = get2d(canvas);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ink;
  ctx.lineWidth = lineWidth;

  let drawing = false;
  let stroke: Point[] = [];
  let dirty = false;

  const notify = () => options.onChange?.(dirty);

  function toCanvasPoint(event: PointerEvent): Point {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width > 0 ? width / rect.width : 1;
    const sy = rect.height > 0 ? height / rect.height : 1;
    return { x: (event.clientX - rect.left) * sx, y: (event.clientY - rect.top) * sy };
  }

  function onDown(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    drawing = true;
    stroke = [toCanvasPoint(event)];
    dirty = true;
    canvas.setPointerCapture?.(event.pointerId);
    ctx.beginPath();
    ctx.moveTo(stroke[0]!.x, stroke[0]!.y);
    // A dot: a zero-length path is not rendered, so paint a tiny segment.
    ctx.lineTo(stroke[0]!.x + 0.01, stroke[0]!.y);
    ctx.stroke();
    event.preventDefault();
  }

  function onMove(event: PointerEvent): void {
    if (!drawing) return;
    const point = toCanvasPoint(event);
    const previous = stroke[stroke.length - 1];
    if (!previous) return;
    // Quadratic smoothing through the midpoint of the last two points.
    const midX = (previous.x + point.x) / 2;
    const midY = (previous.y + point.y) / 2;
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.quadraticCurveTo(previous.x, previous.y, midX, midY);
    ctx.stroke();
    stroke.push(point);
    event.preventDefault();
  }

  function onUp(event: PointerEvent): void {
    if (!drawing) return;
    drawing = false;
    const last = stroke[stroke.length - 1];
    if (last) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(last.x + 0.01, last.y);
      ctx.stroke();
    }
    stroke = [];
    canvas.releasePointerCapture?.(event.pointerId);
    notify();
  }

  function onCancel(): void {
    if (!drawing) return;
    drawing = false;
    stroke = [];
    notify();
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointerleave', onCancel);

  return {
    clear() {
      ctx.clearRect(0, 0, width, height);
      stroke = [];
      dirty = false;
      notify();
    },
    isEmpty() {
      return !dirty;
    },
    toAsset() {
      const box = cropToInk(canvas);
      if (!box) return null;
      return { ...box, mode: 'draw', hasAlpha: true };
    },
    destroy() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('pointerleave', onCancel);
    },
  };
}
