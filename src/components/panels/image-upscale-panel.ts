/**
 * The "Upscale Image" panel and its pure resampling maths.
 *
 * The tool deliberately ships **no AI model**. The browser-ready
 * super-resolution ONNX models (APISR, Swin2SR) are GPL-3.0, and this project
 * only bundles permissively licensed code, so the enlargement is classical
 * instead: a separable resampling kernel — Lanczos3, bicubic (Catmull-Rom) or
 * nearest-neighbour — optionally followed by an unsharp mask that puts back the
 * edge contrast interpolation removes. It cannot invent detail that was never
 * captured, and the tool says so.
 *
 * Every piece of maths worth testing lives in the pure section below, so the
 * panel preview and the tool worker import exactly one source of truth: the
 * worker calls the same functions this file does. The DOM wiring in
 * `mountImageUpscalePanel` is the only browser code.
 *
 * Nothing here talks to the network: the image, the preview and the exported
 * file all stay on this device.
 */
import type { FileRunResult, OptionValues } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { createDropZone, downloadBlob, validateFileSelection } from '@/lib/files';
import { formatBytes } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import {
  applyShowWhen,
  bindRangeOutputs,
  clearError,
  readOptions,
  showError,
} from '@/components/workbench/shared';
import { assertCanvasBudget } from '@/tools/image/image-batch';

/* -------------------------------------------------------------------------- */
/*  Interpolation kernels                                                      */
/* -------------------------------------------------------------------------- */

export type Kernel = 'lanczos3' | 'bicubic' | 'nearest';

export const KERNELS: readonly Kernel[] = ['lanczos3', 'bicubic', 'nearest'];

/** Half-width of each kernel's support, in source-pixel units. */
export const KERNEL_SUPPORT: Record<Kernel, number> = {
  lanczos3: 3,
  bicubic: 2,
  nearest: 0.5,
};

/**
 * The kernel's value at distance `t` from its centre, in units of its support,
 * so `kernelValue('lanczos3', 0)` is the peak and `kernelValue('lanczos3', 3)`
 * is the first zero crossing.
 *
 * - `lanczos3` — a windowed sinc over a 3-unit support. Its negative lobes are
 *   what makes it the crispest of the three, and also what can draw a faint
 *   halo beside a hard edge.
 * - `bicubic` — Catmull-Rom (`a = −0.5`) over a 2-unit support; gentler, with
 *   far less ringing.
 * - `nearest` — a 1-unit box: every output pixel copies one source pixel,
 *   which keeps pixel art and icons blocky instead of smearing them.
 */
export function kernelValue(kernel: Kernel, t: number): number {
  const x = Math.abs(t);
  switch (kernel) {
    case 'nearest':
      return x < 0.5 ? 1 : 0;
    case 'bicubic': {
      if (x >= 2) return 0;
      const a = -0.5;
      if (x < 1) return (a + 2) * x * x * x - (a + 3) * x * x + 1;
      return a * x * x * x - 5 * a * x * x + 8 * a * x - 4 * a;
    }
    default: {
      // lanczos3
      if (x === 0) return 1;
      if (x >= 3) return 0;
      const px = Math.PI * x;
      return (3 * Math.sin(px) * Math.sin(px / 3)) / (px * px);
    }
  }
}

/** One (source index, weight) tap for a single output position. */
export interface Weight {
  source: number;
  weight: number;
}

/** Clamp a whole-number coordinate into `0..max`. */
function clampInt(value: number, max: number): number {
  return value < 0 ? 0 : value > max ? max : value;
}

/**
 * The taps one output position takes from a single axis.
 *
 * Upscaling uses the kernel at its natural width, so each source pixel is
 * spread across a few output pixels. Downscaling widens the filter by the scale
 * ratio, which is what turns a plain interpolation kernel into an antialiasing
 * filter — otherwise every other source pixel would be dropped outright.
 *
 * The weights are renormalised over the in-range taps, so a solid-colour source
 * scales to the identical solid colour: no edge darkening and no drift on flat
 * areas, whatever the kernel.
 */
export function axisWeights(
  kernel: Kernel,
  srcLength: number,
  dstLength: number,
  index: number,
): Weight[] {
  if (
    !Number.isInteger(srcLength) ||
    !Number.isInteger(dstLength) ||
    srcLength < 1 ||
    dstLength < 1
  ) {
    throw new ToolError('The image dimensions must be positive whole pixels.');
  }
  if (!Number.isInteger(index) || index < 0 || index >= dstLength) {
    throw new ToolError('The output position is outside the target axis.');
  }
  const ratio = srcLength / dstLength;
  if (kernel === 'nearest') {
    return [{ source: clampInt(Math.floor((index + 0.5) * ratio), srcLength - 1), weight: 1 }];
  }
  const widen = ratio > 1 ? ratio : 1;
  const support = KERNEL_SUPPORT[kernel] * widen;
  const center = (index + 0.5) * ratio - 0.5;
  const first = Math.ceil(center - support);
  const last = Math.floor(center + support);
  const taps: Weight[] = [];
  let total = 0;
  for (let j = first; j <= last; j++) {
    // Taps outside the source contribute nothing; dropping them here is what
    // the renormalisation below compensates for.
    if (j < 0 || j >= srcLength) continue;
    const weight = kernelValue(kernel, (center - j) / widen);
    if (weight === 0) continue;
    total += weight;
    taps.push({ source: j, weight });
  }
  if (total === 0) {
    // Unreachable for a valid centre, but a defined answer beats dividing by zero.
    return [{ source: clampInt(Math.round(center), srcLength - 1), weight: 1 }];
  }
  for (const tap of taps) tap.weight /= total;
  return taps;
}

/** One weight list per destination index along an axis. */
function weightTable(kernel: Kernel, srcLength: number, dstLength: number): Weight[][] {
  const table: Weight[][] = [];
  for (let i = 0; i < dstLength; i++) table.push(axisWeights(kernel, srcLength, dstLength, i));
  return table;
}

/* -------------------------------------------------------------------------- */
/*  Resampling                                                                 */
/* -------------------------------------------------------------------------- */

/** A tightly packed RGBA buffer with straight (non-premultiplied) channels. */
export interface PixelBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Reject a buffer whose byte length does not match its declared size. */
function assertBuffer(buffer: PixelBuffer): void {
  const { data, width, height } = buffer;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    data.length !== width * height * 4
  ) {
    throw new ToolError('The pixel buffer does not match its declared dimensions.');
  }
}

/**
 * Resample `source` to `width`×`height` with a separable kernel, returning a
 * fresh buffer (the input is never modified).
 *
 * Alpha is premultiplied before filtering and unpremultiplied afterwards, so a
 * semi-transparent edge keeps its colour instead of picking up the black
 * usually stored behind fully transparent pixels. A result with no remaining
 * opacity is written as transparent black rather than a fringed colour.
 */
export function resample(
  source: PixelBuffer,
  width: number,
  height: number,
  kernel: Kernel,
): PixelBuffer {
  assertBuffer(source);
  if (!KERNELS.includes(kernel)) {
    throw new ToolError(
      `Unknown interpolation "${String(kernel)}".`,
      'Choose Lanczos3, bicubic or nearest.',
    );
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new ToolError('The target size must be at least 1×1 pixel.');
  }
  const dw = Math.max(1, Math.round(width));
  const dh = Math.max(1, Math.round(height));
  const sw = source.width;
  const sh = source.height;
  if (dw === sw && dh === sh) {
    return { data: new Uint8ClampedArray(source.data), width: sw, height: sh };
  }

  const data = source.data;
  // 8-bit intermediates on purpose: a Float32 buffer would cost four times the
  // memory, and a 48 MP export (an ordinary 2× of a 12 MP photo) has to stay
  // affordable in a tab.
  const premultiplied = new Uint8ClampedArray(sw * sh * 4);
  for (let i = 0; i < premultiplied.length; i += 4) {
    const alpha = data[i + 3]! / 255;
    premultiplied[i] = Math.round(data[i]! * alpha);
    premultiplied[i + 1] = Math.round(data[i + 1]! * alpha);
    premultiplied[i + 2] = Math.round(data[i + 2]! * alpha);
    premultiplied[i + 3] = data[i + 3]!;
  }

  const xTaps = weightTable(kernel, sw, dw);
  const yTaps = weightTable(kernel, sh, dh);

  // Horizontal pass: `sh` rows of `dw` premultiplied pixels.
  const mid = new Uint8ClampedArray(sh * dw * 4);
  for (let y = 0; y < sh; y++) {
    const rowBase = y * sw * 4;
    const midBase = y * dw * 4;
    for (let x = 0; x < dw; x++) {
      const taps = xTaps[x]!;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (const tap of taps) {
        const si = rowBase + tap.source * 4;
        const weight = tap.weight;
        r += premultiplied[si]! * weight;
        g += premultiplied[si + 1]! * weight;
        b += premultiplied[si + 2]! * weight;
        a += premultiplied[si + 3]! * weight;
      }
      const di = midBase + x * 4;
      mid[di] = Math.round(r);
      mid[di + 1] = Math.round(g);
      mid[di + 2] = Math.round(b);
      mid[di + 3] = Math.round(a);
    }
  }

  // Vertical pass, unpremultiplying into the final 8-bit buffer.
  const out = new Uint8ClampedArray(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const taps = yTaps[y]!;
    const rowBase = y * dw * 4;
    for (let x = 0; x < dw; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (const tap of taps) {
        const si = tap.source * dw * 4 + x * 4;
        const weight = tap.weight;
        r += mid[si]! * weight;
        g += mid[si + 1]! * weight;
        b += mid[si + 2]! * weight;
        a += mid[si + 3]! * weight;
      }
      const di = rowBase + x * 4;
      if (a > 0.5) {
        const inverse = 255 / a;
        out[di] = Math.round(r * inverse);
        out[di + 1] = Math.round(g * inverse);
        out[di + 2] = Math.round(b * inverse);
        out[di + 3] = Math.round(a);
      } else {
        out[di] = 0;
        out[di + 1] = 0;
        out[di + 2] = 0;
        out[di + 3] = 0;
      }
    }
  }
  return { data: out, width: dw, height: dh };
}

/* -------------------------------------------------------------------------- */
/*  Unsharp mask                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A normalised 1-D Gaussian kernel covering `−radius..radius`. Weights sum to 1,
 * so blurring a solid colour returns the identical colour.
 */
export function gaussianKernel(radius: number, sigma = radius / 2): number[] {
  const r = Math.max(1, Math.round(radius));
  const s = Math.max(0.25, sigma);
  const weights: number[] = [];
  let total = 0;
  for (let i = -r; i <= r; i++) {
    const weight = Math.exp(-(i * i) / (2 * s * s));
    weights.push(weight);
    total += weight;
  }
  for (let i = 0; i < weights.length; i++) weights[i] = weights[i]! / total;
  return weights;
}

/** Blur a buffer in place with a separable Gaussian, clamping at the edges. */
function gaussianBlur(buffer: PixelBuffer, radius: number): void {
  const { data, width, height } = buffer;
  const weights = gaussianKernel(radius);
  const r = (weights.length - 1) / 2;
  // 8-bit again: the blur runs over the whole upscaled image, so a float buffer
  // would multiply the peak memory of an already-large export.
  const tmp = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    const rowBase = y * width * 4;
    for (let x = 0; x < width; x++) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      for (let k = -r; k <= r; k++) {
        const si = rowBase + clampInt(x + k, width - 1) * 4;
        const weight = weights[k + r]!;
        red += data[si]! * weight;
        green += data[si + 1]! * weight;
        blue += data[si + 2]! * weight;
        alpha += data[si + 3]! * weight;
      }
      const di = rowBase + x * 4;
      tmp[di] = Math.round(red);
      tmp[di + 1] = Math.round(green);
      tmp[di + 2] = Math.round(blue);
      tmp[di + 3] = Math.round(alpha);
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      for (let k = -r; k <= r; k++) {
        const si = (clampInt(y + k, height - 1) * width + x) * 4;
        const weight = weights[k + r]!;
        red += tmp[si]! * weight;
        green += tmp[si + 1]! * weight;
        blue += tmp[si + 2]! * weight;
        alpha += tmp[si + 3]! * weight;
      }
      const di = (y * width + x) * 4;
      data[di] = Math.round(red);
      data[di + 1] = Math.round(green);
      data[di + 2] = Math.round(blue);
      data[di + 3] = Math.round(alpha);
    }
  }
}

/**
 * Unsharp mask: `out = src + amount × (src − blurred(src))`, clamped to the byte
 * range. `amount` is a fraction (1 = 100%); a non-positive amount or radius
 * returns an untouched copy. A flat area is unchanged, because its blur equals
 * itself — only edges gain contrast.
 */
export function unsharpMask(source: PixelBuffer, amount: number, radius: number): PixelBuffer {
  assertBuffer(source);
  const out: PixelBuffer = {
    data: new Uint8ClampedArray(source.data),
    width: source.width,
    height: source.height,
  };
  if (!(amount > 0) || !(radius > 0)) return out;
  const blurred: PixelBuffer = {
    data: new Uint8ClampedArray(source.data),
    width: source.width,
    height: source.height,
  };
  gaussianBlur(blurred, radius);
  for (let i = 0; i < out.data.length; i++) {
    out.data[i] = Math.round(out.data[i]! + amount * (out.data[i]! - blurred.data[i]!));
  }
  return out;
}

/** Composite a buffer over a solid colour, returning an opaque buffer. */
export function compositeOver(
  source: PixelBuffer,
  background: readonly [number, number, number],
): PixelBuffer {
  assertBuffer(source);
  const out = new Uint8ClampedArray(source.width * source.height * 4);
  const [red, green, blue] = background;
  const data = source.data;
  for (let i = 0; i < out.length; i += 4) {
    const alpha = data[i + 3]! / 255;
    out[i] = Math.round(data[i]! * alpha + red * (1 - alpha));
    out[i + 1] = Math.round(data[i + 1]! * alpha + green * (1 - alpha));
    out[i + 2] = Math.round(data[i + 2]! * alpha + blue * (1 - alpha));
    out[i + 3] = 255;
  }
  return { data: out, width: source.width, height: source.height };
}

/* -------------------------------------------------------------------------- */
/*  Scale and format maths                                                     */
/* -------------------------------------------------------------------------- */

export const OUTPUT_FORMATS: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/** The scale-factor choices the form offers; anything else is a user error. */
export const SCALE_CHOICES: readonly string[] = ['2', '4', 'custom'];

/** Custom scale range, as whole percentages above 100 (this tool only enlarges). */
export const MIN_CUSTOM_PERCENT = 101;
export const MAX_CUSTOM_PERCENT = 800;

/** Sharpening range, as whole percentages (0 disables the unsharp mask). */
export const MAX_SHARPEN_PERCENT = 200;

/** The largest preview the panel draws, so the main thread stays responsive. */
export const MAX_PREVIEW_PIXELS = 500_000;

/** Coerce an option value to a finite number, falling back when it is absent. */
function numberOption(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/** Clamp into an inclusive range. */
function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export interface UpscaleOptions {
  /** `'2'`, `'4'` or `'custom'`. */
  scale: string;
  /** Custom scale percentage; only used when `scale === 'custom'`. */
  percent: number;
  kernel: Kernel;
  /** Sharpening strength as a whole percentage (0 = off). */
  sharpen: number;
  /** Grow the sharpening radius with the scale factor. */
  detail: boolean;
  mime: string;
  /** Encode quality as a 0–1 fraction, or `undefined` for lossless PNG. */
  quality: number | undefined;
}

/** Parse and validate the option bag. Shared by the worker and the preview. */
export function readUpscaleOptions(values: Record<string, unknown>): UpscaleOptions {
  const scale = String(values.scale ?? '2');
  if (!SCALE_CHOICES.includes(scale)) {
    throw new ToolError(
      `Unknown scale factor "${scale}".`,
      'Choose 2×, 4× or a custom percentage.',
    );
  }
  const percent = clamp(
    Math.round(numberOption(values.percent, 150)),
    MIN_CUSTOM_PERCENT,
    MAX_CUSTOM_PERCENT,
  );
  const kernel = String(values.interpolation ?? 'lanczos3') as Kernel;
  if (!KERNELS.includes(kernel)) {
    throw new ToolError(
      `Unknown interpolation "${String(values.interpolation ?? '')}".`,
      'Choose Lanczos3, bicubic or nearest.',
    );
  }
  const sharpen = clamp(Math.round(numberOption(values.sharpen, 40)), 0, MAX_SHARPEN_PERCENT);
  const rawDetail = values.detail;
  const detail = rawDetail === undefined ? true : rawDetail === true || rawDetail === 'true';
  const format = String(values.format ?? 'png');
  const mime = OUTPUT_FORMATS[format];
  if (!mime) {
    throw new ToolError(`Unknown output format "${format}".`, 'Choose PNG, JPEG or WebP.');
  }
  const quality =
    mime === 'image/png' ? undefined : clamp(numberOption(values.quality, 92), 1, 100) / 100;
  return { scale, percent, kernel, sharpen, detail, mime, quality };
}

export interface UpscalePlan {
  width: number;
  height: number;
  factor: number;
}

/** The target size for a source image, given parsed options. Always larger. */
export function upscaleTarget(
  sourceWidth: number,
  sourceHeight: number,
  options: Pick<UpscaleOptions, 'scale' | 'percent'>,
): UpscalePlan {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth < 1 ||
    sourceHeight < 1
  ) {
    throw new ToolError('The image has no measurable size.');
  }
  const factor = options.scale === 'custom' ? options.percent / 100 : Number(options.scale);
  const safeFactor = Number.isFinite(factor) && factor > 1 ? factor : 2;
  return {
    width: Math.max(sourceWidth + 1, Math.round(sourceWidth * safeFactor)),
    height: Math.max(sourceHeight + 1, Math.round(sourceHeight * safeFactor)),
    factor: safeFactor,
  };
}

/**
 * The sharpening radius for a scale factor. Detail-preserving sharpening keeps
 * the radius at roughly one *source* pixel, so edges are recovered at the new
 * resolution; turning it off pins the radius to 1 output pixel, which only
 * boosts micro-contrast.
 */
export function unsharpRadius(factor: number, detail: boolean): number {
  if (!detail) return 1;
  return Math.max(1, Math.round(factor));
}

export interface PreviewPlan {
  width: number;
  height: number;
  /** Preview size ÷ export size, so `< 1` means the preview is reduced. */
  scale: number;
  downscaled: boolean;
}

/** The preview size for a target size, capped at `maxPixels`. */
export function previewPlan(
  width: number,
  height: number,
  maxPixels = MAX_PREVIEW_PIXELS,
): PreviewPlan {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new ToolError('The image has no measurable size.');
  }
  const scale = width * height > maxPixels ? Math.sqrt(maxPixels / (width * height)) : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
    downscaled: scale < 1,
  };
}

/**
 * The whole pipeline, as one call: resample with the chosen kernel, sharpen
 * with the unsharp mask, and composite onto white for JPEG (which has no alpha
 * channel). Both the worker's export and the panel's preview call this, so what
 * you see is what you get.
 */
export function renderUpscale(
  source: PixelBuffer,
  targetWidth: number,
  targetHeight: number,
  options: UpscaleOptions,
): PixelBuffer {
  assertBuffer(source);
  let out = resample(source, targetWidth, targetHeight, options.kernel);
  if (options.sharpen > 0) {
    const factor = Math.max(targetWidth / source.width, targetHeight / source.height, 1);
    out = unsharpMask(out, options.sharpen / 100, unsharpRadius(factor, options.detail));
  }
  if (options.mime === 'image/jpeg') out = compositeOver(out, [255, 255, 255]);
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Panel wiring                                                               */
/* -------------------------------------------------------------------------- */

const PLACEHOLDER = { width: 16, height: 9 };
/** Debounce for the live preview while an option slider is being dragged. */
const PREVIEW_DEBOUNCE_MS = 120;

/**
 * Decode a file into a bitmap for the preview, honouring EXIF orientation the
 * same way the worker does (`image-batch.ts: decodeOriented`).
 */
async function decodeForPreview(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file);
  }
}

/** Mount the panel into a `[data-image-upscale-panel]` element. */
export function mountImageUpscalePanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'image-upscale';
  const accept = root.dataset.accept || undefined;
  const dropEl = root.querySelector<HTMLElement>('[data-drop]')!;
  const listEl = root.querySelector<HTMLUListElement>('[data-file-list]')!;
  const runBtn = root.querySelector<HTMLButtonElement>('[data-run]')!;
  const cancelBtn = root.querySelector<HTMLButtonElement>('[data-cancel]')!;
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-reset]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-error]')!;
  const progressWrap = root.querySelector<HTMLElement>('[data-progress-wrap]')!;
  const progressBar = root.querySelector<HTMLElement>('[data-progress-bar]')!;
  const progressMsg = root.querySelector<HTMLElement>('[data-progress-msg]')!;
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]')!;
  const outputsEl = root.querySelector<HTMLUListElement>('[data-outputs]')!;
  const notesEl = root.querySelector<HTMLUListElement>('[data-notes]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-preview-canvas]')!;
  const previewStatus = root.querySelector<HTMLElement>('[data-preview-status]')!;
  const optionsRoot = root;
  bindRangeOutputs(optionsRoot);

  if (
    !dropEl ||
    !listEl ||
    !runBtn ||
    !cancelBtn ||
    !resetBtn ||
    !errorBox ||
    !progressWrap ||
    !progressBar ||
    !progressMsg ||
    !resultWrap ||
    !outputsEl ||
    !notesEl ||
    !canvas ||
    !previewStatus
  ) {
    return;
  }

  let file: File | null = null;
  let bitmap: ImageBitmap | null = null;
  let controller: AbortController | null = null;
  /** Bumped on every run / load / reset so a late reply cannot publish stale state. */
  let runGeneration = 0;
  let loadGeneration = 0;
  /** Bumped on every option change so a stale debounced preview is dropped. */
  let previewGeneration = 0;
  let previewTimer: number | undefined;
  const resultUrls = new Set<string>();

  function syncRunState(): void {
    runBtn.disabled = !file;
    resetBtn.hidden = !file;
  }

  /** Free the decoded preview bitmap, if any. */
  function releaseBitmap(): void {
    bitmap?.close();
    bitmap = null;
  }

  function revokeResultUrls(): void {
    for (const url of resultUrls) URL.revokeObjectURL(url);
    resultUrls.clear();
  }

  /* ---------------------------------------------------------------------- */
  /*  Preview                                                                */
  /* ---------------------------------------------------------------------- */

  function clearPreview(message: string): void {
    releaseBitmap();
    canvas.width = PLACEHOLDER.width;
    canvas.height = PLACEHOLDER.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(127, 127, 127, 0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    previewStatus.textContent = message;
  }

  /**
   * Draw the upscaled result into the preview canvas. Large targets are drawn
   * at a reduced resolution (via `previewPlan`) so the main thread stays
   * responsive; the status line says when that has happened. The maths is the
   * same `renderUpscale` the worker uses for the full-resolution export.
   */
  function renderPreview(): void {
    if (!bitmap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      previewStatus.textContent =
        'This browser cannot draw a 2D canvas, so the preview is unavailable.';
      return;
    }
    let options: UpscaleOptions;
    let target: UpscalePlan;
    try {
      options = readUpscaleOptions(readOptions(optionsRoot));
      target = upscaleTarget(bitmap.width, bitmap.height, options);
      assertCanvasBudget(target.width, target.height, 'upscaled image');
    } catch (error) {
      previewStatus.textContent =
        error instanceof ToolError ? error.message : 'The upscale options could not be used.';
      return;
    }
    /** The factor label: `2×`, `4×`, or `150%`. */
    const factorText =
      target.factor === 2 || target.factor === 4
        ? `${target.factor}×`
        : `${Math.round(target.factor * 100)}%`;
    const preview = previewPlan(target.width, target.height);
    if (canvas.width !== preview.width || canvas.height !== preview.height) {
      canvas.width = preview.width;
      canvas.height = preview.height;
    }
    const scratch = document.createElement('canvas');
    scratch.width = bitmap.width;
    scratch.height = bitmap.height;
    const sctx = scratch.getContext('2d');
    if (!sctx) {
      previewStatus.textContent =
        'This browser cannot draw a 2D canvas, so the preview is unavailable.';
      return;
    }
    sctx.drawImage(bitmap, 0, 0);
    const source: PixelBuffer = {
      data: sctx.getImageData(0, 0, bitmap.width, bitmap.height).data,
      width: bitmap.width,
      height: bitmap.height,
    };
    try {
      const out = renderUpscale(source, preview.width, preview.height, options);
      const image = ctx.createImageData(preview.width, preview.height);
      image.data.set(out.data);
      ctx.putImageData(image, 0, 0);
      const scaleNote = preview.downscaled
        ? ` · preview at ${Math.round(preview.scale * 100)}% of the export size`
        : '';
      previewStatus.textContent =
        `${bitmap.width}×${bitmap.height} → ${target.width}×${target.height} ` +
        `(${factorText})${scaleNote}`;
    } catch (error) {
      previewStatus.textContent =
        error instanceof ToolError ? error.message : 'The preview could not be rendered.';
    }
  }

  /** Debounced option-change handler so dragging a slider stays smooth. */
  function schedulePreview(): void {
    const generation = ++previewGeneration;
    if (previewTimer !== undefined) window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      if (generation !== previewGeneration) return;
      renderPreview();
    }, PREVIEW_DEBOUNCE_MS);
  }

  /* ---------------------------------------------------------------------- */
  /*  File selection                                                         */
  /* ---------------------------------------------------------------------- */

  function renderList(): void {
    listEl.textContent = '';
    if (!file) return;
    const li = document.createElement('li');
    li.className = 'flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5';
    const name = document.createElement('span');
    name.className = 'truncate';
    name.textContent = file.name;
    const right = document.createElement('span');
    right.className = 'flex shrink-0 items-center gap-2 text-xs text-[rgb(var(--text-muted))]';
    right.textContent = formatBytes(file.size);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.dataset.remove = '';
    remove.setAttribute('aria-label', `Remove ${file.name}`);
    remove.className = 'hover:text-[rgb(var(--danger))]';
    remove.textContent = '✕';
    remove.addEventListener('click', () => void setFile(null));
    right.append(remove);
    li.append(name, right);
    listEl.append(li);
    syncRunState();
  }

  async function setFile(next: File | null): Promise<void> {
    const generation = ++loadGeneration;
    revokeResultUrls();
    file = next;
    clearError(errorBox);
    resultWrap.hidden = true;
    outputsEl.innerHTML = '';
    notesEl.innerHTML = '';
    renderList();
    if (!file) {
      clearPreview('Choose an image to see it here.');
      return;
    }
    previewStatus.textContent = 'Loading the image…';
    let decoded: ImageBitmap;
    try {
      decoded = await decodeForPreview(file);
      assertCanvasBudget(decoded.width, decoded.height, 'source image');
    } catch (error) {
      if (generation !== loadGeneration) return;
      clearPreview('That image could not be opened.');
      showError(
        errorBox,
        error instanceof ToolError ? error.message : 'That image could not be opened.',
        error instanceof ToolError ? error.hint : 'Choose a PNG, JPEG or WebP image.',
      );
      return;
    }
    if (generation !== loadGeneration) {
      decoded.close();
      return;
    }
    releaseBitmap();
    bitmap = decoded;
    syncRunState();
    renderPreview();
  }

  const dropZone = createDropZone(dropEl, {
    accept,
    multiple: false,
    onFiles: (files) => {
      const next = files[0] ?? null;
      if (next) {
        const limit = validateFileSelection([next]);
        if (limit) {
          showError(errorBox, limit);
          return;
        }
      }
      void setFile(next);
    },
  });

  listEl.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]');
    if (!button) return;
    void setFile(null);
  });

  /* ---------------------------------------------------------------------- */
  /*  Options                                                                */
  /* ---------------------------------------------------------------------- */

  /** Fill the controls from an option bag (examples) without touching markup. */
  function applyValues(values: OptionValues): void {
    for (const [key, value] of Object.entries(values)) {
      const field = optionsRoot.querySelector<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >(`[data-opt-key="${key}"]`);
      if (!field) continue;
      if (field.dataset.optType === 'boolean') {
        (field as HTMLInputElement).checked = value === true || value === 'true';
      } else {
        field.value = String(value);
      }
      const out = optionsRoot.querySelector<HTMLOutputElement>(`[data-range-out="${key}"]`);
      if (out) out.value = String(value);
    }
    applyShowWhen(optionsRoot);
    schedulePreview();
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-example]')) {
    button.addEventListener('click', () => {
      const parsed: unknown = JSON.parse(button.dataset.exampleOptions ?? '{}');
      if (!parsed || typeof parsed !== 'object') return;
      applyValues(parsed as OptionValues);
    });
  }

  optionsRoot.addEventListener('input', () => {
    applyShowWhen(optionsRoot);
    schedulePreview();
  });
  optionsRoot.addEventListener('change', () => {
    applyShowWhen(optionsRoot);
    schedulePreview();
  });

  /* ---------------------------------------------------------------------- */
  /*  Run                                                                    */
  /* ---------------------------------------------------------------------- */

  function renderOutputs(result: FileRunResult): void {
    resultWrap.hidden = false;
    outputsEl.innerHTML = '';
    for (const output of result.outputs) {
      const li = document.createElement('li');
      li.className =
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2';
      const preview = document.createElement('img');
      const url = URL.createObjectURL(output.blob);
      resultUrls.add(url);
      preview.src = url;
      preview.alt = `Preview of ${output.filename}`;
      preview.className = 'max-h-64 w-auto rounded border';
      const name = document.createElement('span');
      name.className = 'min-w-0 flex-1 truncate text-sm';
      name.textContent = `${output.filename} · ${formatBytes(output.blob.size)}`;
      const download = document.createElement('button');
      download.type = 'button';
      download.className = 'btn btn-subtle btn-sm shrink-0';
      download.textContent = 'Save';
      download.addEventListener('click', () => downloadBlob(output.blob, output.filename));
      li.append(preview, name, download);
      outputsEl.append(li);
    }
    notesEl.innerHTML = '';
    for (const warning of result.warnings ?? []) {
      const li = document.createElement('li');
      li.style.color = 'rgb(var(--warning))';
      li.textContent = `⚠ ${warning}`;
      notesEl.append(li);
    }
    for (const note of result.notes ?? []) {
      const li = document.createElement('li');
      li.className = 'text-[rgb(var(--text-muted))]';
      li.textContent = note;
      notesEl.append(li);
    }
  }

  async function run(): Promise<void> {
    if (!file) return;
    const limit = validateFileSelection([file]);
    if (limit) {
      showError(errorBox, limit);
      return;
    }
    controller?.abort();
    const generation = ++runGeneration;
    controller = new AbortController();
    clearError(errorBox);
    runBtn.disabled = true;
    cancelBtn.hidden = false;
    progressWrap.hidden = false;
    progressBar.style.width = '0%';
    progressMsg.textContent = 'Working…';
    resultWrap.hidden = true;
    revokeResultUrls();

    try {
      const result = await runToolById<FileRunResult>(
        toolId,
        { files: [file], options: readOptions(optionsRoot) },
        {
          signal: controller.signal,
          onProgress: (fraction, message) => {
            if (generation !== runGeneration) return;
            const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
            progressBar.style.width = `${percent}%`;
            progressMsg.textContent = message ? `${message} — ${percent}%` : `${percent}%`;
          },
        },
      );
      if (generation !== runGeneration) return;
      progressBar.style.width = '100%';
      progressMsg.textContent = 'Done';
      renderOutputs(result);
    } catch (error) {
      if (generation !== runGeneration) return;
      const err = error as Error & { hint?: string };
      if (err.name === 'AbortError') progressMsg.textContent = 'Cancelled';
      else showError(errorBox, err.message || 'Upscaling the image failed', err.hint);
    } finally {
      if (generation === runGeneration) {
        runBtn.disabled = false;
        cancelBtn.hidden = true;
        controller = null;
      }
    }
  }

  runBtn.addEventListener('click', () => void run());
  cancelBtn.addEventListener('click', () => controller?.abort());

  resetBtn.addEventListener('click', () => {
    runGeneration += 1;
    loadGeneration += 1;
    previewGeneration += 1;
    controller?.abort();
    controller = null;
    void setFile(null);
    progressWrap.hidden = true;
    progressMsg.textContent = '';
    outputsEl.innerHTML = '';
    notesEl.innerHTML = '';
    resultWrap.hidden = true;
    clearError(errorBox);
  });

  window.addEventListener(
    'beforeunload',
    () => {
      controller?.abort();
      runGeneration += 1;
      loadGeneration += 1;
      previewGeneration += 1;
      if (previewTimer !== undefined) window.clearTimeout(previewTimer);
      revokeResultUrls();
      releaseBitmap();
      dropZone.destroy();
    },
    { once: true },
  );

  syncRunState();
  applyShowWhen(optionsRoot);
  clearPreview('Choose an image to see it here.');
}
