import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import {
  KERNELS,
  MAX_CUSTOM_PERCENT,
  MIN_CUSTOM_PERCENT,
  axisWeights,
  compositeOver,
  gaussianKernel,
  kernelValue,
  mountImageUpscalePanel,
  previewPlan,
  readUpscaleOptions,
  renderUpscale,
  resample,
  unsharpMask,
  unsharpRadius,
  upscaleTarget,
  type Kernel,
  type PixelBuffer,
} from './image-upscale-panel';
import { installImageMock, type MockHandle } from '@/tools/image/image-mock';
import { runToolById } from '@/lib/worker/client';
import type { FileRunResult } from '@/lib/types';

// The panel never talks to a real worker in a unit test.
vi.mock('@/lib/worker/client', () => ({ runToolById: vi.fn() }));

const runToolByIdMock = vi.mocked(runToolById);

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

type Rgba = [number, number, number, number];

const RED: Rgba = [255, 0, 0, 255];
const GREEN: Rgba = [0, 255, 0, 255];
const BLUE: Rgba = [0, 0, 255, 255];
const WHITE: Rgba = [255, 255, 255, 255];
const BLACK: Rgba = [0, 0, 0, 255];
const CLEAR: Rgba = [0, 0, 0, 0];
/** Row-major quadrants of the 2×2 test image. */
const QUADRANTS: Rgba[] = [RED, GREEN, BLUE, WHITE];

/** Build a pixel buffer from a per-pixel colour function. */
function buffer(width: number, height: number, color: (x: number, y: number) => Rgba): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = color(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return { data, width, height };
}

/** A buffer filled with one colour. */
function solid(width: number, height: number, color: Rgba): PixelBuffer {
  return buffer(width, height, () => color);
}

/** The 2×2 four-quadrant test image. */
function quadrants(): PixelBuffer {
  return buffer(2, 2, (x, y) => QUADRANTS[y * 2 + x]!);
}

/** Read one pixel as a 4-tuple. */
function at(target: PixelBuffer, x: number, y: number): number[] {
  const i = (y * target.width + x) * 4;
  return [target.data[i]!, target.data[i + 1]!, target.data[i + 2]!, target.data[i + 3]!];
}

/** Every pixel of a buffer, in row-major order. */
function pixels(target: PixelBuffer): number[][] {
  const out: number[][] = [];
  for (let y = 0; y < target.height; y++) {
    for (let x = 0; x < target.width; x++) out.push(at(target, x, y));
  }
  return out;
}

/** Pixels where any colour channel is set (ignoring alpha). */
function litPixels(target: PixelBuffer): number {
  let count = 0;
  for (let i = 0; i < target.data.length; i += 4) {
    if (target.data[i]! > 0 || target.data[i + 1]! > 0 || target.data[i + 2]! > 0) count += 1;
  }
  return count;
}

/* -------------------------------------------------------------------------- */
/*  Kernels                                                                    */
/* -------------------------------------------------------------------------- */

describe('kernelValue', () => {
  it('peaks at 1 and is symmetric for every kernel', () => {
    for (const kernel of KERNELS) {
      expect(kernelValue(kernel, 0)).toBe(1);
      expect(kernelValue(kernel, -1.3)).toBeCloseTo(kernelValue(kernel, 1.3), 12);
      expect(kernelValue(kernel, -0.4)).toBeCloseTo(kernelValue(kernel, 0.4), 12);
    }
  });

  it('falls to zero at and beyond each support radius', () => {
    expect(kernelValue('nearest', 0.5)).toBe(0);
    expect(kernelValue('bicubic', 2)).toBe(0);
    expect(kernelValue('bicubic', 7)).toBe(0);
    expect(kernelValue('lanczos3', 3)).toBe(0);
    expect(kernelValue('lanczos3', 12)).toBe(0);
    expect(kernelValue('nearest', 4)).toBe(0);
  });

  it('has the documented negative lobes (and nearest has none)', () => {
    // Lanczos3 crosses zero at 1 and 2 and dips negative between them.
    expect(kernelValue('lanczos3', 1)).toBeCloseTo(0, 12);
    expect(kernelValue('lanczos3', 2)).toBeCloseTo(0, 12);
    expect(kernelValue('lanczos3', 1.5)).toBeLessThan(0);
    // Catmull-Rom bicubic rings too, on both sides of its first zero.
    expect(kernelValue('bicubic', 1.5)).toBeLessThan(0);
    expect(kernelValue('bicubic', 0.5)).toBeGreaterThan(0);
    // Nearest is a plain 1-unit box: never negative.
    for (let t = 0; t <= 4; t += 0.05) expect(kernelValue('nearest', t)).toBeGreaterThanOrEqual(0);
  });

  it('is a normalised bell for the two interpolating kernels', () => {
    // The kernel is monotone away from the centre, with no other interior peak.
    expect(kernelValue('lanczos3', 0.25)).toBeLessThan(1);
    expect(kernelValue('lanczos3', 0.25)).toBeGreaterThan(0);
    expect(kernelValue('bicubic', 0.25)).toBeGreaterThan(kernelValue('bicubic', 0.75));
    expect(kernelValue('lanczos3', 0.25)).toBeGreaterThan(kernelValue('lanczos3', 0.75));
  });
});

describe('axisWeights', () => {
  it('duplicates each source pixel under nearest at 2×', () => {
    for (let i = 0; i < 8; i++) {
      const taps = axisWeights('nearest', 4, 8, i);
      expect(taps).toEqual([{ source: Math.floor(i / 2), weight: 1 }]);
    }
  });

  it('sums to 1 at every output position, upscaling and downscaling', () => {
    for (const kernel of KERNELS) {
      for (const [src, dst] of [
        [4, 8],
        [5, 10],
        [8, 4],
        [13, 40],
        [40, 13],
      ] as const) {
        for (let i = 0; i < dst; i++) {
          const total = axisWeights(kernel, src, dst, i).reduce((sum, t) => sum + t.weight, 0);
          expect(total).toBeCloseTo(1, 10);
        }
      }
    }
  });

  it('uses 1, 4 and 5 taps at 2× — the kernel fingerprints', () => {
    // Analytic support widths for a 5→10 axis: nearest 1, bicubic 2 each side,
    // lanczos3 3 each side (clipped by the source edge at either end).
    expect(axisWeights('nearest', 5, 10, 4)).toHaveLength(1);
    expect(axisWeights('bicubic', 5, 10, 4)).toHaveLength(4);
    expect(axisWeights('lanczos3', 5, 10, 4)).toHaveLength(5);
    expect(axisWeights('bicubic', 5, 10, 4).map((t) => t.source)).toEqual([0, 1, 2, 3]);
  });

  it('carries negative taps for the ringing kernels, none for nearest', () => {
    const lanczos = axisWeights('lanczos3', 8, 16, 3);
    const bicubic = axisWeights('bicubic', 8, 16, 3);
    expect(lanczos.some((t) => t.weight < 0)).toBe(true);
    expect(bicubic.some((t) => t.weight < 0)).toBe(true);
    expect(axisWeights('nearest', 8, 16, 3).some((t) => t.weight < 0)).toBe(false);
  });

  it('widens the filter (and gathers more taps) when downscaling', () => {
    const up = axisWeights('lanczos3', 8, 16, 8);
    const down = axisWeights('lanczos3', 16, 8, 4);
    expect(down.length).toBeGreaterThan(up.length);
    expect(down.length).toBeLessThanOrEqual(16);
  });

  it('rejects an impossible axis or output position', () => {
    expect(() => axisWeights('lanczos3', 0, 4, 0)).toThrow(ToolError);
    expect(() => axisWeights('lanczos3', 4, 4, 4)).toThrow(/outside the target axis/);
    expect(() => axisWeights('lanczos3', 4, 4, -1)).toThrow(/outside the target axis/);
  });
});

/* -------------------------------------------------------------------------- */
/*  Resampling                                                                 */
/* -------------------------------------------------------------------------- */

describe('resample', () => {
  it('produces exactly the requested pixel dimensions', () => {
    const out = resample(solid(3, 2, BLACK), 6, 4, 'lanczos3');
    expect(out.width).toBe(6);
    expect(out.height).toBe(4);
    expect(out.data).toHaveLength(6 * 4 * 4);
    const uneven = resample(solid(7, 5, BLACK), 13, 9, 'bicubic');
    expect([uneven.width, uneven.height]).toEqual([13, 9]);
    expect(uneven.data).toHaveLength(13 * 9 * 4);
  });

  it('returns a fresh buffer when the size is unchanged', () => {
    const src = quadrants();
    const out = resample(src, 2, 2, 'bicubic');
    expect(out.data).not.toBe(src.data);
    expect([...out.data]).toEqual([...src.data]);
  });

  it('scales a solid colour to the identical solid colour for every kernel', () => {
    for (const kernel of KERNELS) {
      const out = resample(solid(3, 3, [40, 80, 120, 255]), 6, 6, kernel);
      for (const pixel of pixels(out)) expect(pixel).toEqual([40, 80, 120, 255]);
    }
  });

  it('keeps a solid semi-transparent colour identical too', () => {
    for (const kernel of KERNELS) {
      const out = resample(solid(4, 4, [10, 20, 30, 128]), 8, 8, kernel);
      for (const pixel of pixels(out)) expect(pixel).toEqual([10, 20, 30, 128]);
    }
  });

  it('never darkens or brightens the border of a solid image (no edge error)', () => {
    // A 1-pixel-wide solid strip is where a badly normalised kernel shows its
    // worst edge artefact: the taps that fall outside the source.
    const out = resample(solid(1, 5, [200, 100, 50, 255]), 3, 15, 'lanczos3');
    for (const pixel of pixels(out)) expect(pixel).toEqual([200, 100, 50, 255]);
  });

  it('preserves the four quadrants of a 2×2 image at 2× for every kernel', () => {
    for (const kernel of KERNELS) {
      const out = resample(quadrants(), 4, 4, kernel);
      expect(at(out, 0, 0)).toEqual([255, 0, 0, 255]);
      expect(at(out, 3, 0)).toEqual([0, 255, 0, 255]);
      expect(at(out, 0, 3)).toEqual([0, 0, 255, 255]);
      expect(at(out, 3, 3)).toEqual([255, 255, 255, 255]);
    }
  });

  it('reproduces whole source blocks under nearest at 2×', () => {
    const out = resample(quadrants(), 4, 4, 'nearest');
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        expect(at(out, x, y)).toEqual(QUADRANTS[Math.floor(y / 2) * 2 + Math.floor(x / 2)]!);
      }
    }
  });

  it('spreads one bright pixel by exactly the kernel weights', () => {
    // A single white pixel on a black, opaque row: every output pixel is
    // 255 × that kernel's weight for source pixel 2, so the impulse response
    // *is* the kernel — and nearest can only ever produce a 2-pixel block.
    const src = buffer(5, 1, (x) => (x === 2 ? WHITE : BLACK));
    for (const kernel of KERNELS) {
      const out = resample(src, 10, 1, kernel);
      for (let x = 0; x < 10; x++) {
        const tap = axisWeights(kernel, 5, 10, x).find((entry) => entry.source === 2);
        const expected = Math.min(255, Math.max(0, Math.round(255 * (tap?.weight ?? 0))));
        expect(at(out, x, 0)).toEqual([expected, expected, expected, 255]);
      }
    }
  });

  it('spreads the impulse further with a wider kernel', () => {
    const src = buffer(5, 1, (x) => (x === 2 ? WHITE : BLACK));
    const nearest = litPixels(resample(src, 10, 1, 'nearest'));
    const bicubic = litPixels(resample(src, 10, 1, 'bicubic'));
    const lanczos = litPixels(resample(src, 10, 1, 'lanczos3'));
    expect(nearest).toBe(2);
    expect(bicubic).toBeGreaterThan(nearest);
    expect(lanczos).toBeGreaterThanOrEqual(bicubic);
  });

  it('keeps a fully transparent pixel transparent under nearest', () => {
    const src = buffer(2, 1, (x) => (x === 0 ? CLEAR : WHITE));
    const out = resample(src, 4, 1, 'nearest');
    expect(at(out, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(at(out, 1, 0)).toEqual([0, 0, 0, 0]);
    expect(at(out, 2, 0)).toEqual([255, 255, 255, 255]);
    expect(at(out, 3, 0)).toEqual([255, 255, 255, 255]);
  });

  it('gives an opaque/transparent edge a fractional alpha', () => {
    const src = buffer(2, 1, (x) => (x === 0 ? CLEAR : WHITE));
    const out = resample(src, 8, 1, 'lanczos3');
    const alphas = pixels(out).map((pixel) => pixel[3]!);
    expect(alphas.some((alpha) => alpha > 0 && alpha < 255)).toBe(true);
    expect(alphas[alphas.length - 1]).toBe(255);
  });

  it('does not bleed the colour hidden behind a transparent pixel', () => {
    // Opaque red stored behind alpha 0 must contribute nothing: with straight
    // (non-premultiplied) filtering this pixel would come out pink.
    const src = buffer(2, 1, (x) => (x === 0 ? [255, 0, 0, 0] : [0, 0, 255, 255]));
    const out = resample(src, 8, 1, 'bicubic');
    const pixel = at(out, 5, 0);
    expect(pixel[0]).toBe(0);
    expect(pixel[2]).toBe(255);
    expect(pixel[3]!).toBeGreaterThan(0);
    expect(pixel[3]!).toBeLessThan(255);
  });

  it('rejects an unknown kernel, a malformed buffer and a zero target', () => {
    expect(() => resample(solid(2, 2, BLACK), 4, 4, 'cubic' as Kernel)).toThrow(
      /Unknown interpolation/,
    );
    expect(() =>
      resample({ data: new Uint8ClampedArray(3), width: 2, height: 2 }, 4, 4, 'bicubic'),
    ).toThrow(/does not match/);
    expect(() => resample(solid(2, 2, BLACK), 0, 4, 'bicubic')).toThrow(/at least 1×1/);
  });
});

/* -------------------------------------------------------------------------- */
/*  Unsharp mask                                                               */
/* -------------------------------------------------------------------------- */

describe('gaussianKernel', () => {
  it('is normalised, symmetric and centred', () => {
    const weights = gaussianKernel(2);
    expect(weights).toHaveLength(5);
    expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 12);
    expect(weights[0]).toBeCloseTo(weights[4]!, 12);
    expect(weights[1]).toBeCloseTo(weights[3]!, 12);
    expect(weights[2]!).toBeGreaterThan(weights[1]!);
  });

  it('treats a fractional or tiny radius as at least one pixel', () => {
    expect(gaussianKernel(0.4)).toHaveLength(3);
    expect(gaussianKernel(1.6)).toHaveLength(5);
    expect(gaussianKernel(4)).toHaveLength(9);
  });
});

describe('unsharpMask', () => {
  /** A vertical edge: left half mid-grey 100, right half mid-grey 150. */
  function edge(): PixelBuffer {
    return buffer(8, 8, (x) => (x < 4 ? [100, 100, 100, 255] : [150, 150, 150, 255]));
  }

  it('has no effect at amount 0 and never mutates its input', () => {
    const src = edge();
    const before = [...src.data];
    const out = unsharpMask(src, 0, 2);
    expect([...out.data]).toEqual(before);
    expect([...src.data]).toEqual(before);
    expect(out.data).not.toBe(src.data);
  });

  it('leaves a solid colour exactly unchanged', () => {
    const out = unsharpMask(solid(6, 6, [77, 133, 201, 255]), 1.5, 3);
    for (const pixel of pixels(out)) expect(pixel).toEqual([77, 133, 201, 255]);
  });

  it('increases contrast on either side of an edge', () => {
    const src = edge();
    const out = unsharpMask(src, 1, 1);
    expect(at(out, 3, 4)[0]!).toBeLessThan(100);
    expect(at(out, 4, 4)[0]!).toBeGreaterThan(150);
  });

  it('sharpens harder as the amount grows', () => {
    const src = edge();
    const gentle = unsharpMask(src, 0.5, 1);
    const strong = unsharpMask(src, 2, 1);
    expect(at(strong, 3, 4)[0]!).toBeLessThan(at(gentle, 3, 4)[0]!);
    expect(at(strong, 4, 4)[0]!).toBeGreaterThan(at(gentle, 4, 4)[0]!);
  });

  it('uses a wider radius for the detail-preserving mode', () => {
    const src = edge();
    const narrow = unsharpMask(src, 1, unsharpRadius(4, false));
    const wide = unsharpMask(src, 1, unsharpRadius(4, true));
    // A 4-px radius reaches a pixel 2 px from the edge; the 1-px radius cannot.
    expect(at(wide, 2, 4)[0]!).toBeLessThan(100);
    expect(at(narrow, 2, 4)[0]).toBe(100);
  });
});

describe('compositeOver', () => {
  it('keeps an opaque pixel and replaces a transparent one with the background', () => {
    const out = compositeOver(
      buffer(2, 1, (x) => (x === 0 ? [12, 34, 56, 255] : CLEAR)),
      [255, 255, 255],
    );
    expect(at(out, 0, 0)).toEqual([12, 34, 56, 255]);
    expect(at(out, 1, 0)).toEqual([255, 255, 255, 255]);
  });

  it('blends a half-transparent grey onto white', () => {
    const out = compositeOver(solid(1, 1, [0, 0, 0, 128]), [255, 255, 255]);
    expect(at(out, 0, 0)).toEqual([127, 127, 127, 255]);
  });

  it('blends a coloured pixel over a different colour', () => {
    const out = compositeOver(solid(1, 1, [255, 0, 0, 128]), [0, 0, 255]);
    expect(at(out, 0, 0)).toEqual([128, 0, 127, 255]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Scale and format maths                                                     */
/* -------------------------------------------------------------------------- */

describe('readUpscaleOptions', () => {
  it('fills every field from its defaults when options are omitted', () => {
    const options = readUpscaleOptions({});
    expect(options).toEqual({
      scale: '2',
      percent: 150,
      kernel: 'lanczos3',
      sharpen: 40,
      detail: true,
      mime: 'image/png',
      quality: undefined,
    });
  });

  it('parses a custom percentage, an alternative kernel and a JPEG quality', () => {
    const options = readUpscaleOptions({
      scale: 'custom',
      percent: '175',
      interpolation: 'bicubic',
      sharpen: '0',
      format: 'jpeg',
      quality: '85',
    });
    expect(options.percent).toBe(175);
    expect(options.kernel).toBe('bicubic');
    expect(options.sharpen).toBe(0);
    expect(options.mime).toBe('image/jpeg');
    expect(options.quality).toBe(0.85);
  });

  it('clamps out-of-range numbers to the declared bounds', () => {
    const options = readUpscaleOptions({
      scale: 'custom',
      percent: '9000',
      interpolation: 'lanczos3',
      sharpen: '500',
      format: 'webp',
      quality: '5',
    });
    expect(options.percent).toBe(MAX_CUSTOM_PERCENT);
    expect(options.sharpen).toBe(200);
    expect(options.quality).toBe(0.05);
    const low = readUpscaleOptions({ scale: 'custom', percent: '10' });
    expect(low.percent).toBe(MIN_CUSTOM_PERCENT);
  });

  it('treats a string boolean correctly and falls back when absent', () => {
    expect(readUpscaleOptions({ detail: 'false' }).detail).toBe(false);
    expect(readUpscaleOptions({ detail: true }).detail).toBe(true);
    expect(readUpscaleOptions({}).detail).toBe(true);
  });

  it('rejects an unknown scale, kernel or format', () => {
    expect(() => readUpscaleOptions({ scale: '3' })).toThrow(/Unknown scale factor/);
    expect(() => readUpscaleOptions({ interpolation: 'sinc' })).toThrow(/Unknown interpolation/);
    expect(() => readUpscaleOptions({ format: 'gif' })).toThrow(/Unknown output format/);
  });
});

describe('upscaleTarget', () => {
  it('doubles and quadruples the source exactly', () => {
    expect(upscaleTarget(100, 50, { scale: '2', percent: 150 })).toEqual({
      width: 200,
      height: 100,
      factor: 2,
    });
    expect(upscaleTarget(90, 60, { scale: '4', percent: 150 })).toEqual({
      width: 360,
      height: 240,
      factor: 4,
    });
  });

  it('applies a custom percentage', () => {
    expect(upscaleTarget(400, 300, { scale: 'custom', percent: 250 })).toEqual({
      width: 1000,
      height: 750,
      factor: 2.5,
    });
  });

  it('rounds fractional custom factors to whole pixels', () => {
    const plan = upscaleTarget(101, 101, { scale: 'custom', percent: 150 });
    expect(plan.width).toBe(152);
    expect(plan.height).toBe(152);
  });

  it('never returns a dimension equal to or smaller than the source', () => {
    const plan = upscaleTarget(1, 1, { scale: 'custom', percent: MIN_CUSTOM_PERCENT });
    expect(plan.width).toBeGreaterThan(1);
    expect(plan.height).toBeGreaterThan(1);
  });

  it('rejects a non-finite or zero source size', () => {
    expect(() => upscaleTarget(0, 5, { scale: '2', percent: 150 })).toThrow(/no measurable size/);
    expect(() => upscaleTarget(5, Number.NaN, { scale: '2', percent: 150 })).toThrow(
      /no measurable size/,
    );
  });
});

describe('unsharpRadius', () => {
  it('scales with the factor only in the detail-preserving mode', () => {
    expect(unsharpRadius(2, true)).toBe(2);
    expect(unsharpRadius(4, true)).toBe(4);
    expect(unsharpRadius(2, false)).toBe(1);
    expect(unsharpRadius(4, false)).toBe(1);
    expect(unsharpRadius(1.7, true)).toBe(2);
  });
});

describe('previewPlan', () => {
  it('leaves a small target untouched', () => {
    const plan = previewPlan(640, 480);
    expect(plan).toEqual({ width: 640, height: 480, scale: 1, downscaled: false });
  });

  it('caps a huge target to the pixel budget and flags it as downscaled', () => {
    const plan = previewPlan(8000, 6000, 500_000);
    expect(plan.downscaled).toBe(true);
    expect(plan.width * plan.height).toBeLessThanOrEqual(500_000);
    expect(plan.scale).toBeLessThan(1);
    // The preview keeps the source aspect ratio.
    expect(plan.width / plan.height).toBeCloseTo(8000 / 6000, 4);
  });

  it('rejects a non-positive size', () => {
    expect(() => previewPlan(0, 10)).toThrow(/no measurable size/);
  });
});

describe('renderUpscale', () => {
  const options = readUpscaleOptions({ sharpen: 0, format: 'png' });

  it('ties the pipeline together at a known size', () => {
    const out = renderUpscale(quadrants(), 6, 6, options);
    expect([out.width, out.height]).toEqual([6, 6]);
    // The top-left corner is inside the red quadrant, so it stays red: the
    // kernel's negative lobe cancels on the zero channels instead of tinting it.
    expect(at(out, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(at(out, 5, 5)).toEqual([255, 255, 255, 255]);
  });

  it('sharpens when requested and composes JPEG onto white', () => {
    const sharp = readUpscaleOptions({ sharpen: 60, format: 'png' });
    const sharpened = renderUpscale(quadrants(), 4, 4, sharp);
    const jpeg = renderUpscale(quadrants(), 4, 4, readUpscaleOptions({ format: 'jpeg' }));
    // A sharpened image has steeper edges than the unsharpened one at a quadrant
    // boundary — the exact pixel depends on the kernel, so just check it moved.
    const plain = renderUpscale(quadrants(), 4, 4, options);
    expect([...sharpened.data]).not.toEqual([...plain.data]);
    // JPEG output is opaque everywhere.
    for (let i = 3; i < jpeg.data.length; i += 4) expect(jpeg.data[i]).toBe(255);
  });
});

/* -------------------------------------------------------------------------- */
/*  Panel wiring (jsdom)                                                       */
/* -------------------------------------------------------------------------- */

/** The markup `image-upscale.astro` renders, reduced to the hooks the panel binds. */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.imageUpscalePanel = '';
  root.dataset.toolId = 'image-upscale';
  root.dataset.accept = 'image/png,image/jpeg,image/webp';
  root.dataset.multiple = 'false';
  root.setAttribute('aria-label', 'Upscale Image workbench');
  root.innerHTML = `
    <div data-drop role="button" tabindex="0" aria-label="Choose an image or drop it here"></div>
    <ul data-file-list></ul>
    <div data-options>
      <select data-opt-key="scale" data-opt-type="select" aria-label="Scale factor">
        <option value="2" selected>2×</option>
        <option value="4">4×</option>
        <option value="custom">Custom %</option>
      </select>
      <input data-opt-key="percent" data-opt-type="number" type="number" value="150" aria-label="Scale (%)" />
      <select data-opt-key="interpolation" data-opt-type="select" aria-label="Interpolation">
        <option value="lanczos3" selected>Lanczos3</option>
        <option value="bicubic">Bicubic</option>
        <option value="nearest">Nearest</option>
      </select>
      <input data-opt-key="sharpen" data-opt-type="number" type="range" value="40" aria-label="Sharpening" />
      <input data-opt-key="detail" data-opt-type="boolean" type="checkbox" checked aria-label="Detail preserving" />
      <select data-opt-key="format" data-opt-type="select" aria-label="Output format">
        <option value="png" selected>PNG</option>
        <option value="jpeg">JPEG</option>
        <option value="webp">WebP</option>
      </select>
      <input data-opt-key="quality" data-opt-type="number" type="range" value="92" aria-label="Quality" />
    </div>
    <canvas data-preview-canvas width="16" height="9"></canvas>
    <p data-preview-status role="status" aria-live="polite"></p>
    <button type="button" data-run disabled>Upscale</button>
    <button type="button" data-cancel hidden>Cancel</button>
    <button type="button" data-reset hidden>Reset</button>
    <div data-progress-wrap hidden><div data-progress-bar></div><p data-progress-msg aria-live="polite"></p></div>
    <div data-error role="alert" hidden></div>
    <div data-result-wrap hidden><ul data-outputs></ul><ul data-notes></ul></div>
  `;
  document.body.append(root);
  return root;
}

let mock: MockHandle | undefined;

beforeEach(() => {
  mock = installImageMock({ width: 4, height: 2, pixelOutput: true });
  URL.createObjectURL = vi.fn(() => 'blob:upscaled');
  URL.revokeObjectURL = vi.fn();
  runToolByIdMock.mockReset();
  runToolByIdMock.mockResolvedValue({ outputs: [] } as unknown as FileRunResult);
  // jsdom has no 2D canvas: a stub with real ImageData shapes keeps the
  // preview pipeline (getImageData → renderUpscale → putImageData) honest.
  const blank = () => undefined;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        canvas: null,
        imageSmoothingEnabled: true,
        fillStyle: '',
        clearRect: blank,
        fillRect: blank,
        drawImage: blank,
        putImageData: blank,
        createImageData: (width: number, height: number) => ({
          data: new Uint8ClampedArray(width * height * 4),
          width,
          height,
        }),
        getImageData: (_x: number, _y: number, width: number, height: number) => ({
          data: new Uint8ClampedArray(width * height * 4),
          width,
          height,
        }),
      }) as unknown as CanvasRenderingContext2D,
  );
});

afterEach(() => {
  mock?.restore();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('mountImageUpscalePanel', () => {
  it('stays inert until an image is chosen', () => {
    const root = fixture();
    mountImageUpscalePanel(root);
    const run = root.querySelector<HTMLButtonElement>('[data-run]')!;
    expect(run.disabled).toBe(true);
  });

  it('chooses a file, renders a preview and reports the target size', async () => {
    const root = fixture();
    mountImageUpscalePanel(root);
    const input = root.querySelector<HTMLInputElement>('[data-drop] input[type="file"]')!;
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'photo.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => {
      expect(root.querySelector('[data-preview-status]')!.textContent).toContain('4×2 → 8×4');
    });
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(false);
  });

  it('runs the tool and renders a downloadable output', async () => {
    runToolByIdMock.mockResolvedValue({
      outputs: [
        {
          filename: 'photo-8x4.png',
          blob: new Blob([new Uint8Array(4)], { type: 'image/png' }),
        },
      ],
    });
    const root = fixture();
    mountImageUpscalePanel(root);
    const input = root.querySelector<HTMLInputElement>('[data-drop] input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      value: [new File([new Uint8Array(4)], 'photo.png', { type: 'image/png' })],
      configurable: true,
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(false);
    });
    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    await vi.waitFor(() => {
      expect(root.querySelectorAll('[data-outputs] li').length).toBe(1);
    });
    expect(root.querySelector<HTMLElement>('[data-outputs] li')!.textContent).toContain(
      'photo-8x4.png',
    );
  });
});
