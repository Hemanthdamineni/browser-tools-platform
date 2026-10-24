/**
 * Pure, DOM-free pixel maths for the "Image Filters" tool.
 *
 * The panel (live preview) and the worker (full-resolution export) both call
 * this module, so the exported file is always a faithful re-render of what the
 * user saw in the preview — no CSS approximation, and the exact same pipeline.
 * Everything here works on a plain `Uint8ClampedArray` of RGBA bytes, so it is
 * trivially unit-testable without a canvas.
 */

/** Luma (Rec. 709) weights used for saturation and grayscale. */
const LR = 0.2126;
const LG = 0.7152;
const LB = 0.0722;

/** Clamp into `0..255` (channels are 8-bit). */
function clamp255(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

/** Round then clamp into `0..255` for a stored channel. */
function channel(value: number): number {
  return clamp255(Math.round(value));
}

/* -------------------------------------------------------------------------- */
/*  Parameters                                                                */
/* -------------------------------------------------------------------------- */

/** Fully resolved, validated filter settings. */
export interface FilterParams {
  /** -100..100; 0 = no change. Offset in 8-bit units: `brightness * 2.55`. */
  brightness: number;
  /** -100..100; 0 = no change. Standard pivot-at-128 contrast curve. */
  contrast: number;
  /** -100..100; 0 = no change; -100 = fully desaturated, 100 = vivid. */
  saturation: number;
  /** Rec. 709 luma grayscale. */
  grayscale: boolean;
  /** Classic sepia colour matrix. */
  sepia: boolean;
  /** 0..100; 0 = no sharpening. Unsharp-mask strength. */
  sharpen: number;
}

const clamp = (n: number, min: number, max: number): number =>
  n < min ? min : n > max ? max : n;

/** Coerce an option value to a finite number, or fall back when absent. */
function numberOption(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Turn raw option values (from `resolveOptions()` or the panel form) into
 * validated {@link FilterParams}. Every numeric option is clamped into its
 * declared range, so a bad value degrades to the nearest valid one instead of
 * producing out-of-range pixels. Never throws — the panel re-renders on every
 * keystroke and must not crash on a half-typed number.
 */
export function parseParams(values: Record<string, unknown>): FilterParams {
  return {
    brightness: clamp(numberOption(values.brightness, 0), -100, 100),
    contrast: clamp(numberOption(values.contrast, 0), -100, 100),
    saturation: clamp(numberOption(values.saturation, 0), -100, 100),
    grayscale: values.grayscale === true || values.grayscale === 'true',
    sepia: values.sepia === true || values.sepia === 'true',
    sharpen: clamp(numberOption(values.sharpen, 0), 0, 100),
  };
}

/** True when every adjustment is at its neutral value (nothing will change). */
export function isNeutral(params: FilterParams): boolean {
  return (
    params.brightness === 0 &&
    params.contrast === 0 &&
    params.saturation === 0 &&
    !params.grayscale &&
    !params.sepia &&
    params.sharpen === 0
  );
}

/**
 * "Brightness +30 · Grayscale" — the adjustments currently in effect, for the
 * notes line and the preview status. Unknown/neutral settings read as
 * "No adjustments".
 */
export function describeParams(params: FilterParams): string {
  const parts: string[] = [];
  const signed = (label: string, value: number) => {
    if (value !== 0) parts.push(`${label} ${value > 0 ? '+' : ''}${value}`);
  };
  signed('Brightness', params.brightness);
  signed('Contrast', params.contrast);
  signed('Saturation', params.saturation);
  if (params.grayscale) parts.push('Grayscale');
  if (params.sepia) parts.push('Sepia');
  if (params.sharpen > 0) parts.push(`Sharpen ${params.sharpen}`);
  return parts.length ? parts.join(' · ') : 'No adjustments';
}

/* -------------------------------------------------------------------------- */
/*  Filter pipeline                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A 4×5 colour matrix in row-major order (4 rows × 5 columns: RGBA + a
 * translation column). Applies affine transforms like brightness, contrast,
 * saturation and sepia to a pixel in one multiply-add each. `alpha` is the
 * identity row so it is preserved.
 */
type ColourMatrix = readonly number[];

const IDENTITY: ColourMatrix = [
  1, 0, 0, 0, 0, //
  0, 1, 0, 0, 0, //
  0, 0, 1, 0, 0, //
  0, 0, 0, 1, 0,
];

/** The standard pivot-at-128 contrast factor from the well-known formula
 * `(259 × (C + 255)) / (255 × (259 − C))`. The slider is −100..100, so `C` is
 * scaled to the formula's −255..255 range: −100 flattens everything to mid-grey
 * (factor 0) and +100 is near-threshold; 0 is exactly 1 (no change). */
function contrastFactor(contrast: number): number {
  const c = clamp(contrast, -100, 100) * 2.55;
  if (c === 0) return 1;
  return (259 * (c + 255)) / (255 * (259 - c));
}

/** Brightness matrix: a linear offset of `value × 2.55` on every channel. */
function brightnessMatrix(value: number): ColourMatrix {
  const offset = clamp(value, -100, 100) * 2.55;
  return [
    1, 0, 0, 0, offset, //
    0, 1, 0, 0, offset, //
    0, 0, 1, 0, offset, //
    0, 0, 0, 1, 0,
  ];
}

/** Contrast matrix: scale around 128, identity at 0. */
function contrastMatrix(value: number): ColourMatrix {
  const factor = contrastFactor(value);
  const offset = 128 * (1 - factor);
  return [
    factor, 0, 0, 0, offset, //
    0, factor, 0, 0, offset, //
    0, 0, factor, 0, offset, //
    0, 0, 0, 1, 0,
  ];
}

/** Saturation matrix: scale each channel's distance from the luma axis. */
function saturationMatrix(value: number): ColourMatrix {
  const s = 1 + clamp(value, -100, 100) / 100;
  const inv = 1 - s;
  return [
    LR * inv + s, LG * inv, LB * inv, 0, 0, //
    LR * inv, LG * inv + s, LB * inv, 0, 0, //
    LR * inv, LG * inv, LB * inv + s, 0, 0, //
    0, 0, 0, 1, 0,
  ];
}

/** Grayscale matrix: full desaturation (saturation −100) to Rec. 709 luma. */
const GRAYSCALE: ColourMatrix = saturationMatrix(-100);

/** Sepia matrix, the classic photographic mix. */
const SEPIA: ColourMatrix = [
  0.393, 0.769, 0.189, 0, 0, //
  0.349, 0.686, 0.168, 0, 0, //
  0.272, 0.534, 0.131, 0, 0, //
  0, 0, 0, 1, 0,
];

/** Multiply `left ∘ right` (apply `right` first, then `left`). */
function multiplyColour(left: ColourMatrix, right: ColourMatrix): ColourMatrix {
  const out = new Array(20).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += left[row * 5 + k]! * right[k * 5 + col]!;
      if (col === 4) sum += left[row * 5 + 4]!;
      out[row * 5 + col] = sum;
    }
  }
  return out;
}

/**
 * Compose every active adjustment into one matrix, in the order brightness →
 * contrast → saturation → grayscale → sepia. When nothing is active the result
 * is exactly the identity matrix, so `applyFilters` can early-return and leave
 * the pixels untouched.
 */
function buildColourMatrix(params: FilterParams): ColourMatrix {
  let matrix = IDENTITY;
  matrix = multiplyColour(contrastMatrix(params.contrast), matrix);
  matrix = multiplyColour(brightnessMatrix(params.brightness), matrix);
  matrix = multiplyColour(saturationMatrix(params.saturation), matrix);
  if (params.grayscale) matrix = multiplyColour(GRAYSCALE, matrix);
  if (params.sepia) matrix = multiplyColour(SEPIA, matrix);
  return matrix;
}

/** Apply a colour matrix to one pixel; the last element of each row is added. */
function applyColour(r: number, g: number, b: number, m: ColourMatrix): [number, number, number] {
  return [
    m[0]! * r + m[1]! * g + m[2]! * b + m[4]!,
    m[5]! * r + m[6]! * g + m[7]! * b + m[9]!,
    m[10]! * r + m[11]! * g + m[12]! * b + m[14]!,
  ];
}

/**
 * Apply the full pipeline to `pixels` in place. `pixels` is an RGBA
 * `Uint8ClampedArray` of length `width * height * 4`. Alpha is preserved
 * untouched. Colour adjustments are folded into a single 4×5 matrix (brightness
 * → contrast → saturation → grayscale → sepia), then the unsharp-mask kernel
 * is applied when sharpening is on. The pipeline is the exact one the panel
 * preview and the worker export share.
 */
export function applyFilters(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  params: FilterParams,
): void {
  if (isNeutral(params)) return;
  const matrix = buildColourMatrix(params);
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const [r, g, b] = applyColour(pixels[j]!, pixels[j + 1]!, pixels[j + 2]!, matrix);
    pixels[j] = channel(r);
    pixels[j + 1] = channel(g);
    pixels[j + 2] = channel(b);
    // Alpha is left untouched.
  }

  if (params.sharpen > 0) unsharpMask(pixels, width, height, params.sharpen);
}

/**
 * Unsharp mask: add `amount × (pixel − blurred pixel)` back onto each channel.
 * The blurred copy is a 3×3 box average. At `sharpen === 0` this is a no-op
 * (callers never reach it — `applyFilters` guards). A uniform image is
 * unchanged (blur equals the pixel, so the difference is zero).
 */
function unsharpMask(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  sharpen: number,
): void {
  const amount = clamp(sharpen, 0, 100) / 100;
  const blurred = pixels.slice();
  boxBlur3(blurred, width, height);
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    pixels[j] = channel(pixels[j]! + amount * (pixels[j]! - blurred[j]!));
    pixels[j + 1] = channel(pixels[j + 1]! + amount * (pixels[j + 1]! - blurred[j + 1]!));
    pixels[j + 2] = channel(pixels[j + 2]! + amount * (pixels[j + 2]! - blurred[j + 2]!));
  }
}

/** In-place 3×3 box blur (separable: horizontal then vertical). */
function boxBlur3(pixels: Uint8ClampedArray, width: number, height: number): void {
  const scratch = new Uint8ClampedArray(pixels.length);
  const w = width;
  const h = height;

  // Horizontal pass into `scratch`.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const left = Math.max(0, x - 1);
      const right = Math.min(w - 1, x + 1);
      const span = right - left + 1;
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let xx = left; xx <= right; xx++) {
          sum += pixels[(y * w + xx) * 4 + c]!;
        }
        scratch[(y * w + x) * 4 + c] = Math.round(sum / span);
      }
    }
  }

  // Vertical pass back into `pixels`.
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const top = Math.max(0, y - 1);
      const bottom = Math.min(h - 1, y + 1);
      const span = bottom - top + 1;
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let yy = top; yy <= bottom; yy++) {
          sum += scratch[(yy * w + x) * 4 + c]!;
        }
        pixels[(y * w + x) * 4 + c] = Math.round(sum / span);
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Preview sizing                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Preview canvas size for an image, capped to `maxPixels` so a 50-megapixel
 * photo does not make the panel sluggish. Returns the scale factor between the
 * preview canvas and the real image.
 */
export function previewSize(
  width: number,
  height: number,
  maxPixels = 2_000_000,
): { width: number; height: number; scale: number } {
  const area = width * height;
  if (!area || area <= maxPixels) return { width, height, scale: 1 };
  const scale = Math.sqrt(maxPixels / area);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  return { width: w, height: h, scale: w / width };
}