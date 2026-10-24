import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyFilters,
  describeParams,
  isNeutral,
  parseParams,
  previewSize,
  type FilterParams,
} from './image-filters.core';
import tool from './image-filters.tool';
import { installImageMock, blobPixels, makeFile, pixelAt, type MockHandle } from './image-mock';

let mock: MockHandle | undefined;
afterEach(() => {
  mock?.restore();
  mock = undefined;
  vi.restoreAllMocks();
});

/** Neutral settings — the identity preset. */
const NEUTRAL: FilterParams = parseParams({});

/** Build a 1×N buffer of RGBA pixels from `[r,g,b]` triples (alpha 255). */
function buffer(triples: number[][]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(triples.length * 4);
  triples.forEach(([r, g, b], i) => {
    out[i * 4] = r!;
    out[i * 4 + 1] = g!;
    out[i * 4 + 2] = b!;
    out[i * 4 + 3] = 255;
  });
  return out;
}

const run = (params: Partial<FilterParams>, triples: number[][]) => {
  const pixels = buffer(triples);
  applyFilters(pixels, triples.length, 1, { ...NEUTRAL, ...params });
  return triples.map((_, i) => [pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]]);
};

describe('parseParams', () => {
  it('clamps every numeric option into its declared range', () => {
    const p = parseParams({ brightness: 500, contrast: -500, saturation: 250, sharpen: 999 });
    expect(p.brightness).toBe(100);
    expect(p.contrast).toBe(-100);
    expect(p.saturation).toBe(100);
    expect(p.sharpen).toBe(100);
  });

  it('falls back to neutral for blanks and non-numbers', () => {
    const p = parseParams({ brightness: '', contrast: 'abc', sharpen: null, saturation: undefined });
    expect(p).toMatchObject({ brightness: 0, contrast: 0, saturation: 0, sharpen: 0 });
  });

  it('accepts boolean-ish values for the toggles', () => {
    expect(parseParams({ grayscale: true, sepia: 'true' })).toMatchObject({
      grayscale: true,
      sepia: true,
    });
    expect(parseParams({ grayscale: 'false', sepia: false })).toMatchObject({
      grayscale: false,
      sepia: false,
    });
  });

  it('reads numeric strings coming from the range inputs', () => {
    expect(parseParams({ brightness: '30' }).brightness).toBe(30);
  });
});

describe('isNeutral', () => {
  it('is true only for the untouched preset', () => {
    expect(isNeutral(NEUTRAL)).toBe(true);
    expect(isNeutral({ ...NEUTRAL, sharpen: 1 })).toBe(false);
    expect(isNeutral({ ...NEUTRAL, grayscale: true })).toBe(false);
  });
});

describe('applyFilters — colour maths', () => {
  it('leaves pixels untouched for the identity preset', () => {
    expect(run({}, [[128, 128, 128], [0, 0, 0], [255, 255, 255], [13, 200, 47]])).toEqual([
      [128, 128, 128],
      [0, 0, 0],
      [255, 255, 255],
      [13, 200, 47],
    ]);
  });

  it('adds a brightness offset of 2.55 per unit, clamped to 8-bit', () => {
    // 128 + 20 × 2.55 = 179; white clamps; black lifts.
    expect(run({ brightness: 20 }, [[128, 128, 128], [255, 255, 255], [0, 0, 0]])).toEqual([
      [179, 179, 179],
      [255, 255, 255],
      [51, 51, 51],
    ]);
  });

  it('darkens with negative brightness', () => {
    // 100 − 50 × 2.55 = −27.5 → clamped to 0.
    expect(run({ brightness: -50 }, [[100, 100, 100]])).toEqual([[0, 0, 0]]);
  });

  it('collapses to Rec. 709 luma with grayscale', () => {
    // Red → 0.2126×255 = 54.213 → 54; green → 182.376 → 182; blue → 18.411 → 18.
    expect(run({ grayscale: true }, [[255, 0, 0], [0, 255, 0], [0, 0, 255]])).toEqual([
      [54, 54, 54],
      [182, 182, 182],
      [18, 18, 18],
    ]);
    // Luma weights sum to 1, so white and black are unchanged.
    expect(run({ grayscale: true }, [[255, 255, 255], [0, 0, 0]])).toEqual([
      [255, 255, 255],
      [0, 0, 0],
    ]);
  });

  it('applies the standard sepia matrix at full strength', () => {
    // (128,128,128) → r 1.351×128=172.9→173, g 1.203×128=154.0→154, b 0.937×128=119.9→120.
    expect(run({ sepia: true }, [[128, 128, 128]])).toEqual([[173, 154, 120]]);
  });

  it('scales saturation around the luma axis', () => {
    // -100 fully desaturates to luma; luma of (200,100,50) is 117.65 → 118.
    expect(run({ saturation: -100 }, [[200, 100, 50]])).toEqual([[118, 118, 118]]);
    // 100 doubles the distance from luma, clamping at the extremes.
    // r 117.65+(82.35×2)=282.35→255, g 117.65−35.3=82.35→82, b 117.65−135.3→0.
    expect(run({ saturation: 100 }, [[200, 100, 50]])).toEqual([[255, 82, 0]]);
  });

  it('pivots contrast at mid-grey (128)', () => {
    // Contrast 100 → factor ≈ 129.5, so mid-grey stays and the extremes clip.
    expect(run({ contrast: 100 }, [[128, 128, 128], [192, 192, 192], [64, 64, 64]])).toEqual([
      [128, 128, 128],
      [255, 255, 255],
      [0, 0, 0],
    ]);
    // Contrast −100 → factor 0, so every channel collapses to mid-grey.
    expect(run({ contrast: -100 }, [[0, 0, 0], [255, 255, 255]])).toEqual([
      [128, 128, 128],
      [128, 128, 128],
    ]);
  });

  it('preserves the alpha channel and only rewrites RGB', () => {
    const pixels = buffer([[10, 20, 30]]);
    pixels[3] = 77;
    applyFilters(pixels, 1, 1, parseParams({ brightness: 10 }));
    expect(pixels[3]).toBe(77);
  });
});

describe('applyFilters — unsharp mask', () => {
  it('leaves a uniform image unchanged', () => {
    const pixels = new Uint8ClampedArray(5 * 5 * 4).fill(120);
    const before = pixels.slice();
    applyFilters(pixels, 5, 5, parseParams({ sharpen: 100 }));
    expect(Array.from(pixels)).toEqual(Array.from(before));
  });

  it('boosts the peak of a spike and darkens its neighbourhood', () => {
    // 5×5 all 100 except the centre 200. The separable 3×3 box blur rounds the
    // centre to 111 (133.33 horizontally, then 111 vertically), so the centre
    // becomes 200 + (200 − 111) = 289 → 255 and its neighbours become
    // 100 + (100 − 111) = 89. Far corners blur to exactly 100 and are unchanged.
    const pixels = new Uint8ClampedArray(5 * 5 * 4).fill(100);
    const centre = (2 * 5 + 2) * 4;
    pixels[centre] = pixels[centre + 1] = pixels[centre + 2] = 200;
    applyFilters(pixels, 5, 5, parseParams({ sharpen: 100 }));
    const at = (x: number, y: number) => pixels[(y * 5 + x) * 4];
    expect(at(2, 2)).toBe(255);
    expect(at(3, 2)).toBe(89);
    expect(at(2, 3)).toBe(89);
    expect(at(0, 0)).toBe(100);
  });
});

describe('describeParams', () => {
  it('names every active adjustment', () => {
    expect(describeParams(parseParams({ brightness: 30, grayscale: true, sharpen: 40 }))).toBe(
      'Brightness +30 · Grayscale · Sharpen 40',
    );
    expect(describeParams(NEUTRAL)).toBe('No adjustments');
  });
});

describe('previewSize', () => {
  it('keeps images under the cap at full size', () => {
    expect(previewSize(800, 600)).toEqual({ width: 800, height: 600, scale: 1 });
  });

  it('scales large images down to the pixel cap', () => {
    const size = previewSize(6000, 4000, 2_000_000);
    expect(size.width * size.height).toBeLessThanOrEqual(2_100_000);
    expect(size.width).toBeLessThan(6000);
    expect(size.scale).toBeGreaterThan(0);
    expect(size.scale).toBeLessThan(1);
  });
});

describe('image-filters run', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects a non-image file', async () => {
    const file = makeFile('doc.txt', 'text/plain');
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('applies the pipeline to the full-resolution pixels', async () => {
    mock = installImageMock({
      width: 2,
      height: 1,
      pixels: [128, 128, 128, 255, 10, 20, 30, 255],
      pixelOutput: true,
    });
    const result = await tool.run({
      files: [makeFile('photo.png')],
      options: { brightness: 20 },
    });
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('photo-filtered.png');
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixelAt(pixels, 2, 0, 0)).toEqual([179, 179, 179, 255]);
    expect(pixelAt(pixels, 2, 1, 0)).toEqual([61, 71, 81, 255]);
  });

  it('re-encodes unchanged pixels for the neutral preset', async () => {
    mock = installImageMock({
      width: 1,
      height: 1,
      pixels: [12, 34, 56, 255],
      pixelOutput: true,
    });
    const result = await tool.run({ files: [makeFile('photo.png')], options: {} });
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixelAt(pixels, 1, 0, 0)).toEqual([12, 34, 56, 255]);
    expect(result.notes?.join(' ')).toMatch(/re-encoded unchanged/i);
  });

  it('encodes to the chosen format and passes the quality through', async () => {
    mock = installImageMock({ width: 4, height: 4 });
    const result = await tool.run({
      files: [makeFile('photo.png')],
      options: { format: 'jpeg', quality: 50 },
    });
    const canvas = mock.canvases.at(-1)!;
    expect(canvas.encodes.at(-1)).toEqual({ type: 'image/jpeg', quality: 0.5 });
    expect(result.outputs[0]!.filename).toBe('photo-filtered.jpg');
  });

  it('keeps the source format for the original setting', async () => {
    mock = installImageMock({ width: 4, height: 4, supports: ['image/png', 'image/webp'] });
    const result = await tool.run({
      files: [makeFile('photo.webp', 'image/webp')],
      options: { format: 'original' },
    });
    expect(result.outputs[0]!.filename).toBe('photo-filtered.webp');
  });

  it('reports progress while filtering', async () => {
    mock = installImageMock({ width: 4, height: 4 });
    const onProgress = vi.fn();
    await tool.run({ files: [makeFile('photo.png')], options: { contrast: 20 }, onProgress });
    expect(onProgress).toHaveBeenCalled();
    expect(onProgress.mock.calls.at(-1)?.[0]).toBe(1);
  });

  it('cancels when the signal is already aborted', async () => {
    mock = installImageMock({ width: 4, height: 4 });
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({ files: [makeFile('photo.png')], options: {}, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('reports the applied adjustments in the notes', async () => {
    mock = installImageMock({ width: 4, height: 4 });
    const result = await tool.run({
      files: [makeFile('photo.png')],
      options: { saturation: -40, sepia: true },
    });
    expect(result.notes?.join(' ')).toMatch(/Saturation -40 · Sepia/);
  });
});
