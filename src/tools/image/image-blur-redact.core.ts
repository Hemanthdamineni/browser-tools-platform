/**
 * Pure, DOM-free redaction maths for the image-blur-redact tool.
 *
 * Everything here works on a flat RGBA pixel buffer (`Uint8ClampedArray` plus
 * width/height) so it can be unit-tested in vitest without a canvas. The tool
 * module is only a thin wrapper that decodes the image, calls these functions
 * and re-encodes the result.
 *
 * Regions are expressed in percentages of the source image, so the panel can
 * hand coordinates to `run()` as a plain option value and `run()` stays pure.
 * Effects are applied in array order: the first region paints first, so a later
 * region paints over an earlier one where they overlap (the same order the
 * panel draws them in, last on top).
 */
import { ToolError } from '@/lib/types';

export type RedactEffect = 'blur' | 'pixelate' | 'black';

export const REDACT_EFFECTS: readonly RedactEffect[] = ['blur', 'pixelate', 'black'];

/** Blur radius range accepted from the option form, in source pixels. */
const MAX_BLUR_RADIUS = 64;
/** Pixelate cell-size range accepted from the option form, in source pixels. */
const MAX_CELL_SIZE = 200;
/** Smallest region the panel will create or keep, in percent of each axis. */
export const MIN_REGION_PERCENT = 1;

/** A redaction rectangle in percentages (0–100) of the source image. */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Per-region override of the global effect. */
  effect?: string;
}

/** A rectangle in whole source pixels, relative to the image's top-left. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A region resolved to pixels, with the effect it will draw. */
export interface PixelRegion extends Rect {
  effect: RedactEffect;
  /** Position in the user's list — also the paint order. */
  index: number;
}

export interface RedactParams {
  /** Blur radius in pixels. 0 means "no blur". */
  radius: number;
  /** Pixelate cell size in pixels. 1 means "no pixelation". */
  cellSize: number;
  /** Effect opacity, 0–1. 0 leaves the pixels untouched, 1 replaces them. */
  opacity: number;
}

export interface RegionPlan {
  /** Regions that will be drawn, in paint order. */
  regions: PixelRegion[];
  /** One human-readable line per region that was ignored, and why. */
  skipped: string[];
}

export const NOTHING_TO_REDACT = 'Nothing to redact.';
const NOTHING_HINT =
  'Draw at least one rectangle over the image (or add a region with the “Add a region” button), then run the tool again.';

/* -------------------------------------------------------------------------- */
/*  Option parsing                                                            */
/* -------------------------------------------------------------------------- */

/** Parse the global effect; `undefined`/empty falls back, anything else must match. */
export function parseEffect(value: unknown, fallback: RedactEffect = 'blur'): RedactEffect {
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(value).toLowerCase();
  if ((REDACT_EFFECTS as readonly string[]).includes(text)) return text as RedactEffect;
  throw new ToolError(
    `“${text}” is not a redaction effect.`,
    'Choose blur, pixelate or black.',
  );
}

/**
 * The effect a region will actually draw: its own override when it names a
 * known effect, otherwise the tool-wide fallback. Never throws — the panel uses
 * this to label a rectangle whose override may not be valid yet.
 */
export function regionEffect(region: Region, fallback: RedactEffect = 'blur'): RedactEffect {
  const value = region.effect?.toLowerCase() ?? '';
  return (REDACT_EFFECTS as readonly string[]).includes(value) ? (value as RedactEffect) : fallback;
}

/** Coerce an option value to a finite number, or fall back when it is absent. */
function numberOption(value: unknown, fallback: number, label: string): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) throw new ToolError(`The ${label} must be a number.`);
  return n;
}

/** Clamp into a range (inclusive). */
function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

/**
 * Validate the numeric options and return the parameters the pixel maths needs.
 * Out-of-range values are clamped rather than refused (the sliders cannot go
 * past the ends, but a pasted JSON region list could), while non-numbers are a
 * user-facing error.
 */
export function parseParams(options: Record<string, unknown>): RedactParams {
  const radius = clamp(numberOption(options.radius, 8, 'blur radius'), 0, MAX_BLUR_RADIUS);
  const cellSize = clamp(
    numberOption(options.cellSize, 12, 'pixelate cell size'),
    1,
    MAX_CELL_SIZE,
  );
  const percent = clamp(numberOption(options.opacity, 100, 'opacity'), 0, 100);
  return { radius, cellSize, opacity: percent / 100 };
}

/**
 * Read the `regions` option: a JSON array of `{ x, y, w, h }` rectangles in
 * percentages, each with an optional `effect`. An empty or absent value means
 * "no regions" — `planRegions` turns that into the user-facing error.
 */
export function parseRegions(value: unknown): Region[] {
  if (value === undefined || value === null) return [];
  let data: unknown = value;
  if (typeof value === 'string') {
    const text = value.trim();
    if (text === '') return [];
    try {
      data = JSON.parse(text);
    } catch {
      throw new ToolError(
        'The region list is not valid JSON.',
        'It must be an array like [{"x":10,"y":10,"w":20,"h":20}]. Edit the field or clear it to redraw.',
      );
    }
  }
  if (!Array.isArray(data)) {
    throw new ToolError(
      'The region list must be a JSON array of rectangles.',
      'Edit the field or clear it to redraw the regions on the image.',
    );
  }
  return data.map((item, i) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new ToolError(
        `Region ${i + 1} is not a rectangle.`,
        'Each region needs x, y, w and h numbers in percent.',
      );
    }
    const raw = item as Record<string, unknown>;
    const region: Region = {
      x: Number(raw.x),
      y: Number(raw.y),
      w: Number(raw.w),
      h: Number(raw.h),
    };
    if (raw.effect !== undefined && raw.effect !== null && raw.effect !== '') {
      region.effect = String(raw.effect);
    }
    return region;
  });
}

/* -------------------------------------------------------------------------- */
/*  Resolving regions to pixels                                               */
/* -------------------------------------------------------------------------- */

/**
 * Round a percentage rectangle to whole pixels, clamped to the image. Returns
 * `null` when it cannot cover a single pixel (NaN, zero or negative size, or
 * entirely outside the image).
 */
export function regionToPixels(
  region: Region,
  width: number,
  height: number,
): Rect | null {
  if (
    !Number.isFinite(region.x) ||
    !Number.isFinite(region.y) ||
    !Number.isFinite(region.w) ||
    !Number.isFinite(region.h) ||
    region.w <= 0 ||
    region.h <= 0
  ) {
    return null;
  }
  const x0 = clamp(Math.round((region.x / 100) * width), 0, width);
  const y0 = clamp(Math.round((region.y / 100) * height), 0, height);
  const x1 = clamp(Math.round(((region.x + region.w) / 100) * width), 0, width);
  const y1 = clamp(Math.round(((region.y + region.h) / 100) * height), 0, height);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Why a region could not be used — used for the per-region skip messages. */
function rejectReason(region: Region, width: number, height: number): string {
  if (
    !Number.isFinite(region.x) ||
    !Number.isFinite(region.y) ||
    !Number.isFinite(region.w) ||
    !Number.isFinite(region.h)
  ) {
    return 'its coordinates are not numbers';
  }
  if (region.w <= 0 || region.h <= 0) return 'it has no size';
  const x0 = (region.x / 100) * width;
  const y0 = (region.y / 100) * height;
  const x1 = ((region.x + region.w) / 100) * width;
  const y1 = ((region.y + region.h) / 100) * height;
  if (x1 <= 0 || y1 <= 0 || x0 >= width || y0 >= height) return 'it lies outside the image';
  return 'it is smaller than one pixel';
}

/**
 * Resolve the user's regions against the real image size. Regions that do not
 * land inside the image are reported in `skipped` instead of silently padding
 * the output; the whole call fails when nothing usable is left, so an empty
 * region list can never produce an unchanged file.
 */
export function planRegions(
  regions: Region[],
  width: number,
  height: number,
  fallbackEffect: RedactEffect = 'blur',
): RegionPlan {
  if (!regions.length) throw new ToolError(NOTHING_TO_REDACT, NOTHING_HINT);
  if (!(width >= 1) || !(height >= 1)) {
    throw new ToolError('The image has no measurable size.');
  }
  const usable: PixelRegion[] = [];
  const skipped: string[] = [];
  regions.forEach((region, index) => {
    const effect = parseEffect(region.effect, fallbackEffect);
    const rect = regionToPixels(region, width, height);
    if (!rect) {
      skipped.push(`Region ${index + 1} was skipped: ${rejectReason(region, width, height)}.`);
      return;
    }
    usable.push({ ...rect, effect, index });
  });
  if (!usable.length) {
    throw new ToolError(NOTHING_TO_REDACT, skipped.join(' '));
  }
  return { regions: usable, skipped };
}

/* -------------------------------------------------------------------------- */
/*  Pixel maths — all in place, restricted to a pixel rect                    */
/* -------------------------------------------------------------------------- */

/**
 * Box-blur `pixels` over `rect` with the given radius, in place. Sampling is
 * clamped to `rect`, never to the surrounding image, so a blur can never pull
 * un-redacted detail into the region. A radius below 1 (including `NaN`) is a
 * no-op; a rect that hangs off the image is clipped to the visible part, and one
 * that is entirely outside it is ignored.
 *
 * Implemented as two separable sliding-window passes (horizontal, then
 * vertical), so the cost does not grow with the radius.
 */
export function boxBlur(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  rect: Rect,
  radius: number,
): void {
  const r = Math.floor(radius);
  if (!(r >= 1)) return;
  const bounds = clampPixelRect(rect, width, height);
  if (!bounds) return;
  const layer = readRect(pixels, width, bounds);
  blurLayer(layer, bounds.w, bounds.h, r);
  writeRect(pixels, width, bounds, layer);
}

/** Box-blur a standalone `w×h` layer buffer in place (both passes). */
function blurLayer(layer: Uint8ClampedArray, w: number, h: number, radius: number): void {
  if (!(Math.floor(radius) >= 1) || w < 1 || h < 1) return;
  blurRows(layer, w, h, Math.floor(radius));
  blurColumns(layer, w, h, Math.floor(radius));
}

/** Horizontal half of the separable box blur. */
function blurRows(layer: Uint8ClampedArray, w: number, h: number, radius: number): void {
  const out = new Uint8ClampedArray(layer.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const from = Math.max(0, x - radius);
      const to = Math.min(w - 1, x + radius);
      const count = to - from + 1;
      const target = (y * w + x) * 4;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = from; k <= to; k++) {
        const source = (y * w + k) * 4;
        r += layer[source]!;
        g += layer[source + 1]!;
        b += layer[source + 2]!;
        a += layer[source + 3]!;
      }
      out[target] = Math.round(r / count);
      out[target + 1] = Math.round(g / count);
      out[target + 2] = Math.round(b / count);
      out[target + 3] = Math.round(a / count);
    }
  }
  layer.set(out);
}

/** Vertical half of the separable box blur. */
function blurColumns(layer: Uint8ClampedArray, w: number, h: number, radius: number): void {
  const out = new Uint8ClampedArray(layer.length);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const from = Math.max(0, y - radius);
      const to = Math.min(h - 1, y + radius);
      const count = to - from + 1;
      const target = (y * w + x) * 4;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = from; k <= to; k++) {
        const source = (k * w + x) * 4;
        r += layer[source]!;
        g += layer[source + 1]!;
        b += layer[source + 2]!;
        a += layer[source + 3]!;
      }
      out[target] = Math.round(r / count);
      out[target + 1] = Math.round(g / count);
      out[target + 2] = Math.round(b / count);
      out[target + 3] = Math.round(a / count);
    }
  }
  layer.set(out);
}

/**
 * Replace every `cellSize`×`cellSize` block inside `rect` with its average
 * colour, in place; the grid is aligned to the region's own top-left corner.
 * A cell size of 1 or less is a no-op — each pixel already is its own cell.
 * The rect is clipped to the image first.
 */
export function pixelate(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  rect: Rect,
  cellSize: number,
): void {
  const bounds = clampPixelRect(rect, width, height);
  if (!bounds || !(Math.floor(cellSize) >= 2)) return;
  const layer = readRect(pixels, width, bounds);
  pixelateLayer(layer, bounds.w, bounds.h, cellSize);
  writeRect(pixels, width, bounds, layer);
}

/** Pixelate a standalone `w×h` layer buffer in place, on its own grid. */
function pixelateLayer(layer: Uint8ClampedArray, w: number, h: number, cellSize: number): void {
  const cell = Math.floor(cellSize);
  if (!(cell >= 2) || w < 1 || h < 1) return;
  for (let by = 0; by < h; by += cell) {
    const blockH = Math.min(cell, h - by);
    for (let bx = 0; bx < w; bx += cell) {
      const blockW = Math.min(cell, w - bx);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let y = by; y < by + blockH; y++) {
        for (let x = bx; x < bx + blockW; x++) {
          const i = (y * w + x) * 4;
          r += layer[i]!;
          g += layer[i + 1]!;
          b += layer[i + 2]!;
          a += layer[i + 3]!;
        }
      }
      const count = blockW * blockH;
      const avg = [
        Math.round(r / count),
        Math.round(g / count),
        Math.round(b / count),
        Math.round(a / count),
      ];
      for (let y = by; y < by + blockH; y++) {
        for (let x = bx; x < bx + blockW; x++) {
          const i = (y * w + x) * 4;
          layer[i] = avg[0]!;
          layer[i + 1] = avg[1]!;
          layer[i + 2] = avg[2]!;
          layer[i + 3] = avg[3]!;
        }
      }
    }
  }
}

/** Fill `rect` with solid opaque black (`#000`), in place. */
export function blackOut(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  rect: Rect,
): void {
  const bounds = clampPixelRect(rect, width, height);
  if (!bounds) return;
  for (let y = bounds.y; y < bounds.y + bounds.h; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
      const i = (y * width + x) * 4;
      pixels[i] = 0;
      pixels[i + 1] = 0;
      pixels[i + 2] = 0;
      pixels[i + 3] = 255;
    }
  }
}

/**
 * Round a pixel rect to whole numbers and clip it to the image. Returns `null`
 * when nothing of the rect is left inside the image.
 */
export function clampPixelRect(rect: Rect, width: number, height: number): Rect | null {
  const x0 = clamp(Math.round(rect.x), 0, width);
  const y0 = clamp(Math.round(rect.y), 0, height);
  const x1 = clamp(Math.round(rect.x + rect.w), 0, width);
  const y1 = clamp(Math.round(rect.y + rect.h), 0, height);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Copy a rect out of an image buffer into a standalone `w*h*4` buffer. */
function readRect(pixels: Uint8ClampedArray, width: number, rect: Rect): Uint8ClampedArray {
  const layer = new Uint8ClampedArray(rect.w * rect.h * 4);
  for (let y = 0; y < rect.h; y++) {
    const from = ((rect.y + y) * width + rect.x) * 4;
    layer.set(pixels.subarray(from, from + rect.w * 4), y * rect.w * 4);
  }
  return layer;
}

/** Write a standalone `w*h*4` buffer back into an image buffer at `rect`. */
function writeRect(
  pixels: Uint8ClampedArray,
  width: number,
  rect: Rect,
  layer: Uint8ClampedArray,
): void {
  for (let y = 0; y < rect.h; y++) {
    const to = ((rect.y + y) * width + rect.x) * 4;
    pixels.set(layer.subarray(y * rect.w * 4, (y + 1) * rect.w * 4), to);
  }
}

/**
 * Composite a `rect`-sized layer over the image at `opacity`, in place.
 * Opacity 1 copies the layer in; opacity 0 changes nothing; in between the
 * layer is alpha-blended over the original pixels.
 */
export function blendRect(
  pixels: Uint8ClampedArray,
  width: number,
  rect: Rect,
  layer: Uint8ClampedArray,
  opacity: number,
): void {
  const o = clamp(Number.isFinite(opacity) ? opacity : 0, 0, 1);
  if (o <= 0) return;
  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      const i = ((rect.y + y) * width + rect.x + x) * 4;
      const j = (y * rect.w + x) * 4;
      if (o >= 1) {
        pixels[i] = layer[j]!;
        pixels[i + 1] = layer[j + 1]!;
        pixels[i + 2] = layer[j + 2]!;
        pixels[i + 3] = layer[j + 3]!;
        continue;
      }
      pixels[i] = Math.round(pixels[i]! + (layer[j]! - pixels[i]!) * o);
      pixels[i + 1] = Math.round(pixels[i + 1]! + (layer[j + 1]! - pixels[i + 1]!) * o);
      pixels[i + 2] = Math.round(pixels[i + 2]! + (layer[j + 2]! - pixels[i + 2]!) * o);
      pixels[i + 3] = Math.round(pixels[i + 3]! + (layer[j + 3]! - pixels[i + 3]!) * o);
    }
  }
}

export interface RedactionOutcome {
  /** Regions that actually changed pixels (opacity above zero). */
  applied: number;
  /** Total device pixels covered by those regions, overlaps counted once per region. */
  touchedPixels: number;
}

/**
 * Apply every planned region to `pixels` in place, in array order (later
 * regions paint over earlier ones). The effect for each region is computed on a
 * snapshot of that region's original pixels and then blended back at the
 * configured opacity, so opacity applies to the drawn effect, not to how much
 * of the image is sampled.
 */
export function applyRegions(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  regions: PixelRegion[],
  params: RedactParams,
): RedactionOutcome {
  let applied = 0;
  let touchedPixels = 0;
  for (const region of regions) {
    // A fully transparent effect changes nothing, so it is not "applied".
    if (params.opacity <= 0) continue;
    const rect: Rect = { x: region.x, y: region.y, w: region.w, h: region.h };
    const layer = readRect(pixels, width, rect);
    if (region.effect === 'blur') {
      blurLayer(layer, rect.w, rect.h, params.radius);
    } else if (region.effect === 'pixelate') {
      pixelateLayer(layer, rect.w, rect.h, params.cellSize);
    } else {
      for (let i = 0; i < layer.length; i += 4) {
        layer[i] = 0;
        layer[i + 1] = 0;
        layer[i + 2] = 0;
        layer[i + 3] = 255;
      }
    }
    blendRect(pixels, width, rect, layer, params.opacity);
    applied++;
    touchedPixels += rect.w * rect.h;
  }
  return { applied, touchedPixels };
}

/* -------------------------------------------------------------------------- */
/*  Region geometry for the panel (percentages)                               */
/* -------------------------------------------------------------------------- */

/** Round to two decimals so percentages survive a JSON round-trip unchanged. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Clamp a percentage rectangle into `0..100`, keeping at least `min` per side.
 * Any per-region effect (and any future field) is preserved.
 */
export function clampRegion(region: Region, min = MIN_REGION_PERCENT): Region {
  const w = clamp(Number.isFinite(region.w) ? round2(region.w) : min, min, 100);
  const h = clamp(Number.isFinite(region.h) ? round2(region.h) : min, min, 100);
  const x = clamp(Number.isFinite(region.x) ? round2(region.x) : 0, 0, 100 - w);
  const y = clamp(Number.isFinite(region.y) ? round2(region.y) : 0, 0, 100 - h);
  const next: Region = { x, y, w, h };
  if (region.effect !== undefined) next.effect = region.effect;
  return next;
}

/** Move a region by a percentage delta, keeping it inside the image. */
export function moveRegion(region: Region, dx: number, dy: number): Region {
  const base = clampRegion(region);
  return clampRegion({ ...base, x: base.x + dx, y: base.y + dy });
}

/**
 * Grow or shrink a region from its bottom-right corner. The top-left corner
 * stays put, so the size can only grow as far as the image edge.
 */
export function resizeRegion(region: Region, dw: number, dh: number): Region {
  const base = clampRegion(region);
  return {
    ...base,
    w: clamp(base.w + dw, MIN_REGION_PERCENT, 100 - base.x),
    h: clamp(base.h + dh, MIN_REGION_PERCENT, 100 - base.y),
  };
}

/** Index of the topmost region containing a percentage point, or -1. */
export function regionAt(regions: Region[], x: number, y: number): number {
  for (let i = regions.length - 1; i >= 0; i--) {
    const r = regions[i]!;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

/** Append a region (it becomes the topmost one). */
export function addRegion(regions: Region[], region: Region): Region[] {
  return [...regions, clampRegion(region)];
}

/** Remove the region at `index`; out-of-range indexes leave the list alone. */
export function removeRegionAt(regions: Region[], index: number): Region[] {
  if (index < 0 || index >= regions.length) return regions;
  return regions.filter((_, i) => i !== index);
}

/** Patch one region, re-clamping the result. */
export function updateRegionAt(regions: Region[], index: number, patch: Partial<Region>): Region[] {
  return regions.map((region, i) => (i === index ? clampRegion({ ...region, ...patch }) : region));
}

/** A sensible starting region: 40% wide, 20% tall, centred. */
export function defaultRegion(): Region {
  return { x: 30, y: 40, w: 40, h: 20 };
}
