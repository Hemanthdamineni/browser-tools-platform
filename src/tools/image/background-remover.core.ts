/**
 * Pure, unit-testable core for `background-remover`.
 *
 * Design
 * ------
 * Input   one image file (`accept: image/*`).
 * Options `background` — `transparent` or a solid hex colour the cut-out is
 *         composited onto — and `cutoff`, an edge cutoff applied to the alpha
 *         matte before compositing.
 * Output  a PNG: either with a transparent background, or the subject
 *         flattened onto the chosen solid colour.
 *
 * The heavy part (running the MODNet portrait-matting model) lives in
 * `background-remover.tool.ts` behind an injectable producer, so every rule in
 * this module can be tested without a model, a canvas or a DOM:
 *
 * - `resolveBackground()`   → which background the user asked for.
 * - `normalizeCutoff()` /
 *   `applyCutoff()`         → how the soft alpha matte is sharpened.
 * - `composite()`           → the source-over maths for the final pixels.
 * - `assertInputBytes()` /
 *   `assertInputPixels()`   → the size guard that keeps a huge file from
 *                             killing the tab.
 * - `outputFilename()`      → the output name and MIME type.
 *
 * Nothing here touches the DOM, the canvas or the network.
 */
import { formatBytes } from '@/lib/format';
import { ToolError } from '@/lib/types';
import { parseHexColor, stem } from './common';

/** The output is always a PNG — it is the only format that keeps transparency. */
export const OUTPUT_MIME = 'image/png';

/** An 8-bit RGB colour. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** The background the cut-out is composited onto. */
export interface BackgroundChoice {
  /** `null` means "keep the transparency" (a transparent PNG). */
  rgb: Rgb | null;
  /** Human-readable label, used in the result notes. */
  label: string;
}

/** The alpha matte produced by the model: one sample per pixel. */
export interface Matte {
  /** One alpha sample (0–255) per pixel, row-major. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Resolve the `background` option.
 *
 * Accepts `transparent` (or an empty value) for a transparent PNG, and a
 * 3- or 6-digit hex colour for a solid background. Anything else is a user
 * error, not a silently ignored value.
 */
export function resolveBackground(value: unknown): BackgroundChoice {
  const raw = String(value ?? 'transparent').trim();
  if (raw === '' || raw.toLowerCase() === 'transparent') {
    return { rgb: null, label: 'transparent' };
  }
  const rgb = parseHexColor(raw);
  if (!rgb) {
    throw new ToolError(
      'Enter “transparent” or a hex colour such as #ffffff.',
      'Use a 3- or 6-digit hex value.',
    );
  }
  const hex = [rgb[0], rgb[1], rgb[2]]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('');
  return { rgb: { r: rgb[0], g: rgb[1], b: rgb[2] }, label: `#${hex}` };
}

/**
 * Clamp the `cutoff` option to `0…254`.
 *
 * `0` disables the cutoff (the matte is used exactly as the model produced
 * it). A non-numeric value falls back to `0` rather than failing the run.
 */
export function normalizeCutoff(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(254, Math.max(0, Math.round(n)));
}

/**
 * Apply the edge cutoff to a single alpha sample.
 *
 * Samples at or below the cutoff become fully transparent; the rest are
 * rescaled so the subject keeps its full opacity instead of looking faded.
 * This is a levels-style adjustment, not a hard cut: it is applied once to the
 * matte the model produced.
 */
export function applyCutoff(alpha: number, cutoff: number): number {
  if (cutoff <= 0) return alpha;
  if (alpha <= cutoff) return 0;
  const scaled = ((alpha - cutoff) * 255) / (255 - cutoff);
  return scaled >= 255 ? 255 : Math.round(scaled);
}

/**
 * Composite the source pixels onto a background, using the matte as the alpha.
 *
 * - `background === null` keeps the alpha channel, so the PNG stays
 *   transparent. The colour under a transparent pixel is preserved: some
 *   viewers show a dark fringe when it is not.
 * - A solid background is composited source-over and the result is fully
 *   opaque, which is what "put the subject on a white background" means.
 *
 * `source` holds straight RGBA pixels, `matte` one alpha sample per pixel.
 */
export function composite(
  source: Uint8ClampedArray,
  matte: Uint8ClampedArray,
  width: number,
  height: number,
  background: Rgb | null,
  cutoff = 0,
): Uint8ClampedArray {
  const pixels = Math.max(
    0,
    Math.min(width * height, Math.floor(matte.length), Math.floor(source.length / 4)),
  );
  const out = new Uint8ClampedArray(pixels * 4);
  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    const alpha = applyCutoff(matte[i]!, cutoff);
    const r = source[o]!;
    const g = source[o + 1]!;
    const b = source[o + 2]!;
    if (background === null) {
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = alpha;
      continue;
    }
    const a = alpha / 255;
    const inv = 1 - a;
    out[o] = Math.round(r * a + background.r * inv);
    out[o + 1] = Math.round(g * a + background.g * inv);
    out[o + 2] = Math.round(b * a + background.b * inv);
    out[o + 3] = 255;
  }
  return out;
}

/**
 * The share of pixels the model considers foreground (0…1).
 *
 * A very small or very large share means the model probably did not find a
 * person, which is worth telling the user about.
 */
export function matteCoverage(matte: Uint8ClampedArray, cutoff = 0): number {
  const pixels = matte.length;
  if (pixels === 0) return 0;
  let foreground = 0;
  for (let i = 0; i < pixels; i++) {
    if (applyCutoff(matte[i]!, cutoff) > 0) foreground++;
  }
  return foreground / pixels;
}

/**
 * Validate that an input is a real, non-empty file. There is deliberately no
 * byte or pixel ceiling: the image is processed in this browser only, and the
 * canvas budget raised by the shared helpers is the one real limit.
 */
export function assertInputBytes(bytes: number, name = 'That file'): void {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new ToolError(`${name} has no readable size.`, 'Choose a real image file.');
  }
  if (bytes === 0) {
    throw new ToolError(`“${name}” is empty.`, 'Choose a real image file.');
  }
}

/** Validate that an image reports measurable dimensions. */
export function assertInputPixels(width: number, height: number): void {
  const w = Math.round(width);
  const h = Math.round(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) {
    throw new ToolError('That image has no measurable size.', 'Choose a real image file.');
  }
}

/** The output file name: the source name with a `-no-bg` suffix. */
export function outputFilename(name: string): string {
  return `${stem(name)}-no-bg.png`;
}

/**
 * A snapshot of the model loader's progress, in the shape the shared ML
 * runtime reports it. Declared structurally so this module stays free of any
 * runtime import.
 */
export interface ModelProgress {
  phase: 'resolving' | 'downloading' | 'initializing' | 'ready' | 'error';
  fraction: number | null;
  loaded: number;
  total: number;
  message: string;
}

/**
 * Map the loader's download progress onto the workbench's 0…1 bar.
 *
 * The download gets its own slice of the bar (`base … base + span`) so a slow
 * first run reads as "downloading the model", not as a hung tab. The message
 * always names the byte counts so the user knows how big the model is.
 */
export function modelProgressUpdate(
  progress: ModelProgress,
  base = 0.05,
  span = 0.8,
): { fraction: number; message: string } {
  const fraction = Math.min(1, Math.max(0, base + span * (progress.fraction ?? 0)));
  if (progress.phase === 'downloading') {
    const message =
      progress.total > 0
        ? `Downloading the model (first run only): ${formatBytes(progress.loaded)} of ${formatBytes(progress.total)}`
        : `Downloading the model (first run only): ${formatBytes(progress.loaded)}`;
    return { fraction, message };
  }
  if (progress.phase === 'ready') {
    return { fraction, message: 'Model ready' };
  }
  return { fraction, message: progress.message };
}
