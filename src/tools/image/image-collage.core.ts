/**
 * Pure layout, fit and ordering maths for the "Image Collage" tool.
 *
 * Every function here is a plain function of its arguments — no DOM, no canvas
 * factory, no randomness — so the same geometry drives the live preview, the
 * Web Worker export and the unit tests. `gridCells` turns a cell count and a
 * canvas size into the exact cell rectangles (spacing and centering included),
 * `fitRect` letterboxes one image inside a cell (contain-fit), and the order
 * helpers say which source image lands in which cell, so reordering permutes
 * placements rather than pixels.
 */
import { ToolError } from '@/lib/types';
import { resolveBackground } from './common';

/** An axis-aligned rectangle in canvas pixels. */
export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Read an integer option, clamped to `min..max` and falling back on junk. */
function numberIn(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

/** The identity order: image `i` goes to cell `i`. */
export function defaultOrder(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

/**
 * Parse the serialised image order the panel sends (a comma-separated list of
 * source indices, e.g. "2,0,1") into a validated permutation of `0..count-1`.
 * The default (no order) is the identity. A malformed list is a user error,
 * so it throws a `ToolError` rather than silently misplacing images.
 */
export function parseOrder(raw: unknown, count: number): number[] {
  const value = raw == null || String(raw).trim() === '' ? null : String(raw);
  if (value === null) return defaultOrder(count);
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (parts.length !== count) {
    throw new ToolError(`The image order must list all ${count} images.`);
  }
  const seen = new Set<number>();
  return parts.map((part) => {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n >= count) {
      throw new ToolError(`Invalid position "${part}" in the image order.`);
    }
    if (seen.has(n)) {
      throw new ToolError(`Image ${n} appears twice in the order.`);
    }
    seen.add(n);
    return n;
  });
}

/**
 * The number of grid columns to use. `"auto"` picks a roughly square grid
 * (`ceil(sqrt(count))`); otherwise the value is clamped to `1..count` so a
 * layout never asks for more columns than there are images.
 */
export function resolveColumns(value: unknown, count: number): number {
  const raw = String(value ?? 'auto').trim();
  if (raw === 'auto' || raw === '') return Math.max(1, Math.ceil(Math.sqrt(count)));
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    throw new ToolError('Choose a number of columns, or Auto.');
  }
  return Math.max(1, Math.min(Math.floor(n), count));
}

/** The number of rows a `count`-image grid occupies at `columns` columns. */
export function gridRows(count: number, columns: number): number {
  const cols = resolveColumns(columns, count);
  return Math.max(1, Math.ceil(count / cols));
}

/**
 * The whole collage canvas size for a uniform grid of square `cellSize` cells.
 * Used by the export to render at full resolution — `cellSize` is the largest
 * source edge, so no image is ever upscaled.
 */
export function collageCanvas(
  count: number,
  columns: number,
  spacing: number,
  cellSize: number,
): { width: number; height: number; rows: number } {
  const cols = resolveColumns(columns, count);
  const rows = gridRows(count, cols);
  const gap = Math.max(0, Number.isFinite(spacing) ? Math.floor(spacing) : 0);
  return {
    width: cols * cellSize + gap * (cols - 1),
    height: rows * cellSize + gap * (rows - 1),
    rows,
  };
}

/**
 * The cell rectangles for a `count`-image grid over a `W` × `H` canvas. Cells
 * are uniform, `spacing` separates them, and the grid exactly fills the canvas
 * (so it is automatically centred). Row order is left-to-right, top-to-bottom.
 */
export function gridCells(
  count: number,
  columns: number,
  spacing: number,
  W: number,
  H: number,
): { cells: CellRect[]; rows: number } {
  const cols = resolveColumns(columns, count);
  const rows = Math.max(1, Math.ceil(count / cols));
  const gap = Math.max(0, Number.isFinite(spacing) ? Math.floor(spacing) : 0);
  const cellW = (W - gap * (cols - 1)) / cols;
  const cellH = (H - gap * (rows - 1)) / rows;
  const cells: CellRect[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    cells.push({ x: col * (cellW + gap), y: row * (cellH + gap), w: cellW, h: cellH });
  }
  return { cells, rows };
}

/**
 * Letterbox an `imgW` × `imgH` image inside a `cell` (contain-fit, centred):
 * the image is scaled to fit entirely inside the cell and the leftover space is
 * split equally, so the returned rectangle is the exact draw target.
 */
export function fitRect(cell: CellRect, imgW: number, imgH: number): CellRect {
  const scale = Math.min(cell.w / imgW, cell.h / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return { x: cell.x + (cell.w - w) / 2, y: cell.y + (cell.h - h) / 2, w, h };
}

/**
 * Move the item at `from` to index `to`, returning a new array. Out-of-range
 * moves are ignored. The drag-to-reorder handler in the panel uses this so a
 * reorder is a pure permutation of the list — the images themselves never move.
 */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return list as T[];
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item as T);
  return next;
}

/**
 * A canvas size for the live preview: the same grid but downscaled so a huge
 * collage never makes the panel sluggish. Returns the preview width/height and
 * the scale factor between the preview and the full-resolution export.
 */
export function previewCanvas(
  W: number,
  H: number,
  maxPixels = 2_000_000,
): { width: number; height: number; scale: number } {
  const scale = W * H > maxPixels ? Math.sqrt(maxPixels / (W * H)) : 1;
  return {
    width: Math.max(1, Math.round(W * scale)),
    height: Math.max(1, Math.round(H * scale)),
    scale,
  };
}

/** Fully resolved, validated collage options (shared by the preview and the tool). */
export interface CollageOptions {
  columns: number;
  spacing: number;
  /** CSS colour (`rgb(...)`) or the literal `transparent`. */
  background: string;
  radius: number;
  border: boolean;
  borderColor: string;
  borderWidth: number;
  format: 'png' | 'jpeg';
  /** 0–100. */
  quality: number;
}

/**
 * Turn raw option values (straight from `resolveOptions()` or the panel form)
 * into validated {@link CollageOptions}. Numbers are clamped, colours are
 * checked, and a bad colour throws a `ToolError` so a typo fails loudly instead
 * of silently falling back.
 */
export function readCollageOptions(values: Record<string, unknown>, count: number): CollageOptions {
  const background = resolveBackground(String(values.background ?? 'transparent'));
  const rawBorderColor = resolveBackground(String(values.borderColor ?? '#ffffff'));
  return {
    columns: resolveColumns(values.columns, count),
    spacing: numberIn(values.spacing, 0, Number.MAX_SAFE_INTEGER, 8),
    background,
    radius: numberIn(values.radius, 0, Number.MAX_SAFE_INTEGER, 0),
    // A transparent border would be invisible; fall back to white.
    borderColor: rawBorderColor === 'transparent' ? '#ffffff' : rawBorderColor,
    border: values.border === true || values.border === 'true',
    borderWidth: numberIn(values.borderWidth, 1, Number.MAX_SAFE_INTEGER, 2),
    format: String(values.format ?? 'png') === 'jpeg' ? 'jpeg' : 'png',
    quality: numberIn(values.quality, 40, 100, 92),
  };
}

/**
 * The slice of a 2D context the collage drawing needs — shared verbatim by
 * the worker (full-resolution export) and the panel (downscaled preview), so
 * the preview matches the saved file.
 */
export interface CollageDrawContext {
  save(): void;
  restore(): void;
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, w: number, h: number): void;
  drawImage(image: ImageBitmap, dx: number, dy: number, dWidth: number, dHeight: number): void;
  beginPath(): void;
  clip(): void;
  roundRect?(x: number, y: number, w: number, h: number, radii: number): void;
}

export interface CellStyle {
  radius: number;
  border: boolean;
  borderColor: string;
  borderWidth: number;
}

/**
 * Draw one image into one cell of the collage: letterboxed inside the cell,
 * clipped to rounded corners when `radius > 0`, with an optional border painted
 * as a band around the cell. Rounding is skipped on contexts that cannot clip a
 * rounded path (e.g. a test mock), so the geometry never depends on it.
 */
export function drawCell(
  ctx: CollageDrawContext,
  bitmap: ImageBitmap,
  cell: CellRect,
  fit: CellRect,
  style: CellStyle,
): void {
  ctx.save();
  if (style.radius > 0 && typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(cell.x, cell.y, cell.w, cell.h, style.radius);
    ctx.clip();
  }
  ctx.drawImage(bitmap, fit.x, fit.y, fit.w, fit.h);
  ctx.restore();
  if (style.border && style.borderWidth > 0) {
    ctx.fillStyle = style.borderColor;
    const b = style.borderWidth;
    ctx.fillRect(cell.x, cell.y, cell.w, b);
    ctx.fillRect(cell.x, cell.y + cell.h - b, cell.w, b);
    ctx.fillRect(cell.x, cell.y, b, cell.h);
    ctx.fillRect(cell.x + cell.w - b, cell.y, b, cell.h);
  }
}
