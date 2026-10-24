import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './image-blur-redact.tool';
import {
  MIN_REGION_PERCENT,
  NOTHING_TO_REDACT,
  addRegion,
  applyRegions,
  blackOut,
  blendRect,
  boxBlur,
  clampPixelRect,
  clampRegion,
  defaultRegion,
  moveRegion,
  parseEffect,
  parseParams,
  parseRegions,
  pixelate,
  planRegions,
  regionAt,
  regionEffect,
  regionToPixels,
  removeRegionAt,
  resizeRegion,
  updateRegionAt,
  type PixelRegion,
  type RedactEffect,
  type Region,
} from './image-blur-redact.core';
import { blobPixels, installImageMock, makeFile, type MockHandle } from './image-mock';

/* -------------------------------------------------------------------------- */
/*  Fixtures & helpers                                                        */
/* -------------------------------------------------------------------------- */

/** One greyscale RGBA pixel (alpha 255). */
function gray(v: number): number[] {
  return [v, v, v, 255];
}

/** Build an RGBA buffer from a flat list of greyscale channel values. */
function grayBuffer(values: number[]): Uint8ClampedArray {
  return Uint8ClampedArray.from(values.flatMap((v) => gray(v)));
}

/** Read the red channel of every pixel back out as a row-major grid. */
function grid(pixels: Uint8ClampedArray, width: number, height: number): number[][] {
  const rows: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) row.push(pixels[(y * width + x) * 4]!);
    rows.push(row);
  }
  return rows;
}

/** The full RGBA tuple at (x, y). */
function at(pixels: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const i = (y * width + x) * 4;
  return [pixels[i]!, pixels[i + 1]!, pixels[i + 2]!, pixels[i + 3]!];
}

const FULL_3 = { x: 0, y: 0, w: 3, h: 3 };

/**
 * The 3×3 blur fixture: a diamond of 36 on a black background. Every average
 * below is a whole number, so the expected matrix is exact.
 */
const DIAMOND = [0, 36, 0, 36, 36, 36, 0, 36, 0];

/**
 * Box blur with radius 1 over {@link DIAMOND}: corners average 4 samples,
 * edges 6 and the centre 9 — all clamped to the region, never the image.
 */
const DIAMOND_BLURRED = [
  [27, 24, 27],
  [24, 20, 24],
  [27, 24, 27],
];

function region(x: number, y: number, w: number, h: number, effect?: string): Region {
  return effect ? { x, y, w, h, effect } : { x, y, w, h };
}

function pixelRegion(
  x: number,
  y: number,
  w: number,
  h: number,
  effect: RedactEffect = 'black',
  index = 0,
): PixelRegion {
  return { x, y, w, h, effect, index };
}

/* -------------------------------------------------------------------------- */
/*  Region resolution                                                         */
/* -------------------------------------------------------------------------- */

describe('regionToPixels', () => {
  it('turns percentages into rounded pixel bounds', () => {
    expect(regionToPixels(region(0, 0, 50, 25), 200, 400)).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect(regionToPixels(region(10, 20, 30, 40), 100, 100)).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  });

  it('rounds fractional percentages to whole pixels', () => {
    expect(regionToPixels(region(33.4, 33.5, 33.3, 33.4), 100, 100)).toEqual({
      x: 33,
      y: 34,
      w: 34,
      h: 33,
    });
  });

  it('clamps a region that hangs off the image', () => {
    expect(regionToPixels(region(50, 50, 100, 100), 100, 100)).toEqual({ x: 50, y: 50, w: 50, h: 50 });
    expect(regionToPixels(region(-20, -20, 50, 50), 100, 100)).toEqual({ x: 0, y: 0, w: 30, h: 30 });
  });

  it('rejects regions entirely outside the image', () => {
    expect(regionToPixels(region(200, 0, 10, 10), 100, 100)).toBeNull();
    expect(regionToPixels(region(0, 200, 10, 10), 100, 100)).toBeNull();
    expect(regionToPixels(region(-50, 0, 40, 10), 100, 100)).toBeNull();
  });

  it('rejects NaN, zero and negative sizes', () => {
    expect(regionToPixels(region(Number.NaN, 0, 10, 10), 100, 100)).toBeNull();
    expect(regionToPixels(region(0, Number.NaN, 10, 10), 100, 100)).toBeNull();
    expect(regionToPixels(region(0, 0, 0, 10), 100, 100)).toBeNull();
    expect(regionToPixels(region(0, 0, 10, 0), 100, 100)).toBeNull();
    expect(regionToPixels(region(0, 0, -5, 10), 100, 100)).toBeNull();
  });

  it('rejects a region thinner than one pixel', () => {
    expect(regionToPixels(region(0, 0, 0.4, 10), 100, 100)).toBeNull();
    expect(regionToPixels(region(0, 0, 0.4, 10), 10, 10)).toBeNull();
  });
});

describe('planRegions', () => {
  it('throws ToolError when there is nothing to redact', () => {
    expect(() => planRegions([], 100, 100)).toThrow(ToolError);
    expect(() => planRegions([], 100, 100)).toThrow(/nothing to redact/i);
    expect(NOTHING_TO_REDACT).toBe('Nothing to redact.');
  });

  it('throws when every region falls outside the image', () => {
    expect(() => planRegions([region(200, 200, 10, 10)], 100, 100)).toThrow(/nothing to redact/i);
  });

  it('applies the global effect and keeps the region order', () => {
    const plan = planRegions([region(0, 0, 50, 50), region(50, 50, 50, 50)], 100, 100, 'pixelate');
    expect(plan.regions).toEqual([
      { x: 0, y: 0, w: 50, h: 50, effect: 'pixelate', index: 0 },
      { x: 50, y: 50, w: 50, h: 50, effect: 'pixelate', index: 1 },
    ]);
    expect(plan.skipped).toEqual([]);
  });

  it('lets a region override the global effect', () => {
    const plan = planRegions([region(0, 0, 50, 50, 'black')], 100, 100, 'blur');
    expect(plan.regions[0]!.effect).toBe('black');
  });

  it('clamps a partially visible region instead of dropping it', () => {
    const plan = planRegions([region(50, 50, 100, 100)], 100, 100);
    expect(plan.regions[0]).toMatchObject({ x: 50, y: 50, w: 50, h: 50 });
    expect(plan.skipped).toEqual([]);
  });

  it('reports each unusable region with a reason and renumbers the rest', () => {
    const plan = planRegions(
      [
        region(0, 0, 25, 25),
        region(Number.NaN, 0, 10, 10),
        region(0, 0, 0, 10),
        region(200, 200, 10, 10),
        region(0, 0, 0.1, 0.1),
        region(25, 25, 25, 25),
      ],
      100,
      100,
    );
    expect(plan.regions.map((r) => r.index)).toEqual([0, 5]);
    expect(plan.skipped).toHaveLength(4);
    expect(plan.skipped[0]).toMatch(/region 2 was skipped: its coordinates are not numbers/i);
    expect(plan.skipped[1]).toMatch(/region 3 was skipped: it has no size/i);
    expect(plan.skipped[2]).toMatch(/region 4 was skipped: it lies outside the image/i);
    expect(plan.skipped[3]).toMatch(/region 5 was skipped: it is smaller than one pixel/i);
  });

  it('rejects an unknown effect name', () => {
    expect(() => planRegions([region(0, 0, 50, 50, 'smear')], 100, 100)).toThrow(
      /not a redaction effect/i,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  Packed JSON region lists                                                  */
/* -------------------------------------------------------------------------- */

describe('parseRegions', () => {
  it('parses the JSON the panel writes', () => {
    expect(parseRegions('[{"x":5,"y":5,"w":20,"h":10,"effect":"black"}]')).toEqual([
      { x: 5, y: 5, w: 20, h: 10, effect: 'black' },
    ]);
  });

  it('accepts an already-parsed array', () => {
    expect(parseRegions([{ x: 1, y: 2, w: 3, h: 4 }])).toEqual([{ x: 1, y: 2, w: 3, h: 4 }]);
  });

  it('treats empty values as no regions', () => {
    expect(parseRegions('')).toEqual([]);
    expect(parseRegions('  ')).toEqual([]);
    expect(parseRegions('[]')).toEqual([]);
    expect(parseRegions(undefined)).toEqual([]);
    expect(parseRegions(null)).toEqual([]);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseRegions('[{')).toThrow(/not valid JSON/i);
    expect(() => parseRegions('{"x":1}')).toThrow(/must be a JSON array/i);
    expect(() => parseRegions('42')).toThrow(/must be a JSON array/i);
  });

  it('rejects entries that are not rectangles', () => {
    expect(() => parseRegions('[1]')).toThrow(/region 1 is not a rectangle/i);
    expect(() => parseRegions('[{"x":1,"y":1,"w":1,"h":1},null]')).toThrow(
      /region 2 is not a rectangle/i,
    );
  });
});

describe('parseEffect', () => {
  it('accepts the three effects case-insensitively', () => {
    expect(parseEffect('blur')).toBe('blur');
    expect(parseEffect('Pixelate')).toBe('pixelate');
    expect(parseEffect('BLACK')).toBe('black');
  });

  it('falls back when the value is absent', () => {
    expect(parseEffect(undefined, 'pixelate')).toBe('pixelate');
    expect(parseEffect('', 'pixelate')).toBe('pixelate');
  });

  it('rejects an unknown effect', () => {
    expect(() => parseEffect('smear')).toThrow(/not a redaction effect/i);
  });
});

describe('regionEffect', () => {
  it('uses the region override when it is valid', () => {
    expect(regionEffect(region(0, 0, 1, 1, 'Pixelate'), 'blur')).toBe('pixelate');
  });

  it('falls back when the region has none, or names an unknown effect', () => {
    expect(regionEffect(region(0, 0, 1, 1), 'black')).toBe('black');
    expect(regionEffect(region(0, 0, 1, 1, 'smear'), 'blur')).toBe('blur');
  });
});

describe('parseParams', () => {
  it('uses the declared defaults', () => {
    expect(parseParams({})).toEqual({ radius: 8, cellSize: 12, opacity: 1 });
  });

  it('accepts option values as strings', () => {
    expect(parseParams({ radius: '16', cellSize: '8', opacity: '50' })).toEqual({
      radius: 16,
      cellSize: 8,
      opacity: 0.5,
    });
  });

  it('clamps out-of-range values', () => {
    expect(parseParams({ radius: 1000, cellSize: 0, opacity: 500 })).toEqual({
      radius: 64,
      cellSize: 1,
      opacity: 1,
    });
    expect(parseParams({ radius: -5, cellSize: 1e6, opacity: -20 })).toEqual({
      radius: 0,
      cellSize: 200,
      opacity: 0,
    });
  });

  it('rejects values that are not numbers', () => {
    expect(() => parseParams({ radius: 'wide' })).toThrow(/radius must be a number/i);
    expect(() => parseParams({ opacity: Number.NaN })).toThrow(/opacity must be a number/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  Blur                                                                      */
/* -------------------------------------------------------------------------- */

describe('boxBlur', () => {
  it('is a no-op for radius 0 or a negative radius', () => {
    const pixels = grayBuffer(DIAMOND);
    const before = Uint8ClampedArray.from(pixels);
    boxBlur(pixels, 3, 3, FULL_3, 0);
    expect(grid(pixels, 3, 3)).toEqual([
      [0, 36, 0],
      [36, 36, 36],
      [0, 36, 0],
    ]);
    boxBlur(pixels, 3, 3, FULL_3, -3);
    boxBlur(pixels, 3, 3, FULL_3, Number.NaN);
    expect(Array.from(pixels)).toEqual(Array.from(before));
  });

  it('matches the known 3×3 fixture at radius 1', () => {
    const pixels = grayBuffer(DIAMOND);
    boxBlur(pixels, 3, 3, FULL_3, 1);
    expect(grid(pixels, 3, 3)).toEqual(DIAMOND_BLURRED);
  });

  it('keeps alpha opaque', () => {
    const pixels = grayBuffer(DIAMOND);
    boxBlur(pixels, 3, 3, FULL_3, 1);
    for (let i = 0; i < 9; i++) expect(pixels[i * 4 + 3]).toBe(255);
  });

  it('averages the whole region for a radius far larger than the region', () => {
    const pixels = grayBuffer([10, 20, 30, 40]);
    boxBlur(pixels, 2, 2, { x: 0, y: 0, w: 2, h: 2 }, 50);
    // (10 + 20 + 30 + 40) / 4 = 25 exactly.
    expect(grid(pixels, 2, 2)).toEqual([
      [25, 25],
      [25, 25],
    ]);
  });

  it('never samples pixels from outside the region', () => {
    // Left half black, right half white; only the left half is redacted. If the
    // blur pulled in the white neighbours the region would lighten.
    const pixels = grayBuffer([0, 0, 255, 255]);
    boxBlur(pixels, 4, 1, { x: 0, y: 0, w: 2, h: 1 }, 1);
    expect(grid(pixels, 4, 1)).toEqual([[0, 0, 255, 255]]);
  });

  it('leaves the rest of the image untouched', () => {
    const pixels = grayBuffer([0, 0, 255, 0, 0, 255]);
    boxBlur(pixels, 3, 2, { x: 0, y: 0, w: 2, h: 1 }, 1);
    expect(grid(pixels, 3, 2)).toEqual([
      [0, 0, 255],
      [0, 0, 255],
    ]);
  });

  it('clips a region that hangs off the image', () => {
    const pixels = grayBuffer([10, 20, 30, 40]);
    boxBlur(pixels, 2, 2, { x: -1, y: 0, w: 3, h: 2 }, 1);
    // Clipped to the whole 2×2 image, so every pixel becomes the mean: 25.
    expect(grid(pixels, 2, 2)).toEqual([
      [25, 25],
      [25, 25],
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Pixelate                                                                  */
/* -------------------------------------------------------------------------- */

describe('pixelate', () => {
  it('is a no-op for a cell size of 1 or less', () => {
    const pixels = grayBuffer([0, 10, 20, 30]);
    const before = Uint8ClampedArray.from(pixels);
    pixelate(pixels, 2, 2, { x: 0, y: 0, w: 2, h: 2 }, 1);
    expect(Array.from(pixels)).toEqual(Array.from(before));
  });

  it('averages a whole 3×3 region into one cell', () => {
    const pixels = grayBuffer([0, 10, 20, 30, 40, 50, 60, 70, 80]);
    pixelate(pixels, 3, 3, FULL_3, 3);
    // 360 / 9 = 40 exactly.
    expect(grid(pixels, 3, 3)).toEqual([
      [40, 40, 40],
      [40, 40, 40],
      [40, 40, 40],
    ]);
  });

  it('averages 2×2 cells across the grid', () => {
    const pixels = grayBuffer([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    pixelate(pixels, 4, 4, { x: 0, y: 0, w: 4, h: 4 }, 2);
    expect(grid(pixels, 4, 4)).toEqual([
      [3, 3, 5, 5],
      [3, 3, 5, 5],
      [11, 11, 13, 13],
      [11, 11, 13, 13],
    ]);
  });

  it('only rewrites the region rectangle', () => {
    const pixels = grayBuffer([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    pixelate(pixels, 4, 4, { x: 1, y: 1, w: 2, h: 2 }, 2);
    // 5, 6, 9, 10 average to 7.5 → 8.
    expect(grid(pixels, 4, 4)).toEqual([
      [0, 1, 2, 3],
      [4, 8, 8, 7],
      [8, 8, 8, 11],
      [12, 13, 14, 15],
    ]);
  });

  it('handles a region that is not a whole number of cells', () => {
    const pixels = grayBuffer([0, 0, 0, 20, 20, 0, 0, 0, 0]);
    pixelate(pixels, 3, 3, FULL_3, 2);
    // The 2×2 corner block (0, 0, 20, 20) averages to 10; the trailing row and
    // column form 1-pixel-wide blocks that stay as they are.
    expect(grid(pixels, 3, 3)).toEqual([
      [10, 10, 0],
      [10, 10, 0],
      [0, 0, 0],
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Black out                                                                 */
/* -------------------------------------------------------------------------- */

describe('blackOut', () => {
  it('fills the region with opaque #000 and nothing else', () => {
    const pixels = grayBuffer([10, 20, 30, 40]);
    blackOut(pixels, 2, 2, { x: 1, y: 0, w: 1, h: 2 });
    expect(at(pixels, 2, 0, 0)).toEqual([10, 10, 10, 255]);
    expect(at(pixels, 2, 1, 0)).toEqual([0, 0, 0, 255]);
    expect(at(pixels, 2, 1, 1)).toEqual([0, 0, 0, 255]);
    expect(grid(pixels, 2, 2)[1]![0]).toBe(30);
  });

  it('clips a region that hangs off the image', () => {
    const pixels = grayBuffer([10, 20, 30, 40]);
    blackOut(pixels, 2, 2, { x: 1, y: 1, w: 10, h: 10 });
    expect(grid(pixels, 2, 2)).toEqual([
      [10, 20],
      [30, 0],
    ]);
  });

  it('is a no-op when the region is entirely outside', () => {
    const pixels = grayBuffer([10, 20, 30, 40]);
    const before = Uint8ClampedArray.from(pixels);
    blackOut(pixels, 2, 2, { x: 5, y: 5, w: 2, h: 2 });
    blackOut(pixels, 2, 2, { x: 0, y: 0, w: 0, h: 2 });
    expect(Array.from(pixels)).toEqual(Array.from(before));
  });
});

/* -------------------------------------------------------------------------- */
/*  Blending and opacity                                                      */
/* -------------------------------------------------------------------------- */

describe('blendRect', () => {
  it('copies the layer at full opacity and changes nothing at zero', () => {
    const pixels = grayBuffer([100, 100, 100, 100]);
    const layer = grayBuffer([0, 0, 0, 0]);
    blendRect(pixels, 2, { x: 0, y: 0, w: 2, h: 2 }, layer, 0);
    expect(grid(pixels, 2, 2)).toEqual([
      [100, 100],
      [100, 100],
    ]);
    blendRect(pixels, 2, { x: 0, y: 0, w: 2, h: 2 }, layer, 1);
    expect(grid(pixels, 2, 2)).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('blends halfway at 50%', () => {
    const pixels = grayBuffer([100, 40]);
    const layer = grayBuffer([0, 0]);
    blendRect(pixels, 2, { x: 0, y: 0, w: 2, h: 1 }, layer, 0.5);
    expect(grid(pixels, 2, 1)).toEqual([[50, 20]]);
  });
});

describe('applyRegions', () => {
  const params = (over: Partial<{ radius: number; cellSize: number; opacity: number }> = {}) => ({
    radius: 8,
    cellSize: 2,
    opacity: 1,
    ...over,
  });

  it('changes nothing at 0% opacity', () => {
    const pixels = grayBuffer([10, 20, 30, 40]);
    const before = Uint8ClampedArray.from(pixels);
    const outcome = applyRegions(
      pixels,
      2,
      2,
      [pixelRegion(0, 0, 2, 2, 'black')],
      params({ opacity: 0 }),
    );
    expect(Array.from(pixels)).toEqual(Array.from(before));
    expect(outcome).toEqual({ applied: 0, touchedPixels: 0 });
  });

  it('blends the effect at 50% opacity', () => {
    const pixels = grayBuffer([100, 100, 100, 100]);
    applyRegions(pixels, 2, 2, [pixelRegion(0, 0, 2, 2, 'black')], params({ opacity: 0.5 }));
    expect(grid(pixels, 2, 2)).toEqual([
      [50, 50],
      [50, 50],
    ]);
  });

  it('counts the pixels it covered', () => {
    const pixels = grayBuffer([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const outcome = applyRegions(
      pixels,
      3,
      3,
      [pixelRegion(0, 0, 2, 1, 'black'), pixelRegion(0, 0, 1, 1, 'black', 1)],
      params(),
    );
    expect(outcome.applied).toBe(2);
    // Overlapping regions are counted per region, so the overlap is counted twice.
    expect(outcome.touchedPixels).toBe(3);
  });

  it('paints later regions over earlier ones', () => {
    const base = [200, 10, 20, 30];

    const blackThenPixelate = grayBuffer(base);
    applyRegions(
      blackThenPixelate,
      2,
      2,
      [
        pixelRegion(0, 0, 1, 1, 'black', 0),
        pixelRegion(0, 0, 2, 2, 'pixelate', 1),
      ],
      params({ cellSize: 2 }),
    );
    // Blackening the corner first drags the average down: (0+10+20+30)/4 = 15.
    expect(grid(blackThenPixelate, 2, 2)).toEqual([
      [15, 15],
      [15, 15],
    ]);

    const pixelateThenBlack = grayBuffer(base);
    applyRegions(
      pixelateThenBlack,
      2,
      2,
      [
        pixelRegion(0, 0, 2, 2, 'pixelate', 0),
        pixelRegion(0, 0, 1, 1, 'black', 1),
      ],
      params({ cellSize: 2 }),
    );
    // The pixelate saw the untouched image: (200+10+20+30)/4 = 65, then the
    // corner is blacked out on top.
    expect(grid(pixelateThenBlack, 2, 2)).toEqual([
      [0, 65],
      [65, 65],
    ]);
  });

  it('applies blur through the same entry point', () => {
    const blurred = grayBuffer([0, 0, 255]);
    applyRegions(blurred, 3, 1, [pixelRegion(0, 0, 3, 1, 'blur')], params({ radius: 1 }));
    // Clamped windows: 0 stays 0, the middle averages all three, the last
    // averages its two neighbours (127.5 → 128).
    expect(grid(blurred, 3, 1)).toEqual([[0, 85, 128]]);
  });

  it('averages a region into one value for a very large radius', () => {
    const blurred = grayBuffer([0, 0, 255]);
    applyRegions(blurred, 3, 1, [pixelRegion(0, 0, 3, 1, 'blur')], params({ radius: 64 }));
    expect(grid(blurred, 3, 1)).toEqual([[85, 85, 85]]);
  });

  it('leaves pixels outside every region untouched', () => {
    const pixels = grayBuffer([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    applyRegions(pixels, 3, 3, [pixelRegion(1, 1, 1, 1, 'black')], params());
    expect(grid(pixels, 3, 3)).toEqual([
      [0, 1, 2],
      [3, 0, 5],
      [6, 7, 8],
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Region geometry (panel helpers)                                           */
/* -------------------------------------------------------------------------- */

describe('clampPixelRect', () => {
  it('rounds and clips', () => {
    expect(clampPixelRect({ x: 1.4, y: 0, w: 10, h: 10 }, 5, 5)).toEqual({ x: 1, y: 0, w: 4, h: 5 });
    expect(clampPixelRect({ x: -3, y: -3, w: 10, h: 10 }, 5, 5)).toEqual({ x: 0, y: 0, w: 5, h: 5 });
    expect(clampPixelRect({ x: 9, y: 0, w: 4, h: 4 }, 5, 5)).toBeNull();
  });
});

describe('region geometry', () => {
  it('clamps a region into the image at the minimum size', () => {
    expect(clampRegion(region(90, 90, 50, 50))).toEqual({ x: 50, y: 50, w: 50, h: 50 });
    expect(clampRegion(region(Number.NaN, Number.NaN, Number.NaN, Number.NaN))).toEqual({
      x: 0,
      y: 0,
      w: MIN_REGION_PERCENT,
      h: MIN_REGION_PERCENT,
    });
    expect(clampRegion(region(10, 10, 0, 0))).toEqual({ x: 10, y: 10, w: 1, h: 1 });
  });

  it('moves a region without letting it leave the image', () => {
    expect(moveRegion(region(10, 10, 20, 20), 5, -3)).toEqual({ x: 15, y: 7, w: 20, h: 20 });
    expect(moveRegion(region(10, 10, 20, 20), 100, 0)).toEqual({ x: 80, y: 10, w: 20, h: 20 });
    expect(moveRegion(region(10, 10, 20, 20), -100, -100)).toEqual({ x: 0, y: 0, w: 20, h: 20 });
  });

  it('resizes from the bottom-right corner and keeps a minimum size', () => {
    expect(resizeRegion(region(10, 10, 20, 20), 5, 5)).toEqual({ x: 10, y: 10, w: 25, h: 25 });
    expect(resizeRegion(region(10, 10, 20, 20), -100, -100)).toEqual({ x: 10, y: 10, w: 1, h: 1 });
    expect(resizeRegion(region(10, 10, 20, 20), 100, 100)).toEqual({ x: 10, y: 10, w: 90, h: 90 });
  });

  it('finds the topmost region under a point', () => {
    const regions = [region(0, 0, 50, 50), region(25, 25, 50, 50)];
    expect(regionAt(regions, 10, 10)).toBe(0);
    expect(regionAt(regions, 40, 40)).toBe(1);
    expect(regionAt(regions, 80, 80)).toBe(-1);
  });

  it('adds, removes and patches regions immutably', () => {
    const start: Region[] = [];
    const added = addRegion(start, region(10, 10, 20, 20));
    expect(start).toEqual([]);
    expect(added).toHaveLength(1);
    const patched = updateRegionAt(added, 0, { x: 30 });
    expect(patched[0]).toEqual({ x: 30, y: 10, w: 20, h: 20 });
    expect(added[0]!.x).toBe(10);
    expect(removeRegionAt(patched, 0)).toEqual([]);
    expect(removeRegionAt(patched, 5)).toBe(patched);
  });

  it('keeps a per-region effect through moves, resizes and patches', () => {
    const start = region(10, 10, 20, 20, 'black');
    expect(clampRegion(start)).toEqual({ x: 10, y: 10, w: 20, h: 20, effect: 'black' });
    expect(moveRegion(start, 5, 0)).toEqual({ x: 15, y: 10, w: 20, h: 20, effect: 'black' });
    expect(resizeRegion(start, 5, 5)).toEqual({ x: 10, y: 10, w: 25, h: 25, effect: 'black' });
    expect(updateRegionAt([start], 0, { x: 30 })).toEqual([
      { x: 30, y: 10, w: 20, h: 20, effect: 'black' },
    ]);
  });

  it('starts a new region in the middle of the image', () => {
    expect(defaultRegion()).toEqual({ x: 30, y: 40, w: 40, h: 20 });
  });
});

/* -------------------------------------------------------------------------- */
/*  Tool run()                                                                */
/* -------------------------------------------------------------------------- */

let mock: MockHandle | undefined;
afterEach(() => {
  mock?.restore();
  mock = undefined;
});

const PNG = (name = 'photo.png') => makeFile(name, 'image/png');
/** A 2×2 image whose red channel is 0, 10, 20, 30. */
const BASE_PIXELS = [0, 0, 0, 255, 10, 10, 10, 255, 20, 20, 20, 255, 30, 30, 30, 255];
const REGIONS = '[{"x":50,"y":0,"w":50,"h":100,"effect":"black"}]';
/** The same rectangle with no per-region effect, so the global option applies. */
const REGIONS_PLAIN = '[{"x":50,"y":0,"w":50,"h":100}]';

const reds = (pixels: Uint8ClampedArray) => grid(pixels, 2, 2);

describe('image-blur-redact run', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/choose an image file/i);
  });

  it('rejects a non-image file', async () => {
    const file = makeFile('notes.txt', 'text/plain');
    await expect(tool.run({ files: [file], options: { regions: REGIONS } })).rejects.toThrow(
      /not an image/i,
    );
  });

  it('rejects an empty region list instead of exporting an unchanged file', async () => {
    mock = installImageMock({ width: 2, height: 2, pixels: BASE_PIXELS });
    await expect(tool.run({ files: [PNG()], options: { regions: '[]' } })).rejects.toThrow(
      /nothing to redact/i,
    );
    await expect(tool.run({ files: [PNG()], options: {} })).rejects.toThrow(/nothing to redact/i);
    expect(mock.canvases).toHaveLength(0);
  });

  it('rejects a region list that falls entirely outside the image', async () => {
    mock = installImageMock({ width: 2, height: 2, pixels: BASE_PIXELS });
    await expect(
      tool.run({ files: [PNG()], options: { regions: '[{"x":400,"y":400,"w":10,"h":10}]' } }),
    ).rejects.toThrow(/nothing to redact/i);
  });

  it('blacks out the region and leaves the rest of the pixels alone', async () => {
    mock = installImageMock({ width: 2, height: 2, pixels: BASE_PIXELS, pixelOutput: true });
    const result = await tool.run({
      files: [PNG()],
      options: { regions: REGIONS, effect: 'black', format: 'png' },
    });

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('photo-redacted.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');
    expect(reds(await blobPixels(result.outputs[0]!.blob))).toEqual([
      [0, 0],
      [20, 0],
    ]);
    expect(result.stats).toMatchObject({ files: 1, regions: 1, redactedPixels: 2 });
  });

  it('blurs at the configured radius', async () => {
    mock = installImageMock({ width: 2, height: 2, pixels: BASE_PIXELS, pixelOutput: true });
    const result = await tool.run({
      files: [PNG()],
      options: { regions: REGIONS_PLAIN, effect: 'blur', radius: 4, format: 'png' },
    });
    // The region is the right column (10 and 30); a large radius averages it to
    // 20 and leaves the left column alone.
    expect(reds(await blobPixels(result.outputs[0]!.blob))).toEqual([
      [0, 20],
      [20, 20],
    ]);
  });

  it('leaves the region untouched at radius 0', async () => {
    mock = installImageMock({ width: 2, height: 2, pixels: BASE_PIXELS, pixelOutput: true });
    const result = await tool.run({
      files: [PNG()],
      options: { regions: REGIONS_PLAIN, effect: 'blur', radius: 0, format: 'png' },
    });
    expect(reds(await blobPixels(result.outputs[0]!.blob))).toEqual([
      [0, 10],
      [20, 30],
    ]);
  });

  it('pixelates at the configured cell size', async () => {
    mock = installImageMock({ width: 2, height: 2, pixels: BASE_PIXELS, pixelOutput: true });
    const result = await tool.run({
      files: [PNG()],
      options: { regions: REGIONS_PLAIN, effect: 'pixelate', cellSize: 2, format: 'png' },
    });
    expect(reds(await blobPixels(result.outputs[0]!.blob))).toEqual([
      [0, 20],
      [20, 20],
    ]);
  });

  it('leaves the region untouched when the cell size is 1', async () => {
    mock = installImageMock({ width: 2, height: 2, pixels: BASE_PIXELS, pixelOutput: true });
    const result = await tool.run({
      files: [PNG()],
      options: { regions: REGIONS_PLAIN, effect: 'pixelate', cellSize: 1, format: 'png' },
    });
    expect(reds(await blobPixels(result.outputs[0]!.blob))).toEqual([
      [0, 10],
      [20, 30],
    ]);
  });

  it('blends the effect at 50% opacity', async () => {
    mock = installImageMock({ width: 2, height: 2, pixels: BASE_PIXELS, pixelOutput: true });
    const result = await tool.run({
      files: [PNG()],
      options: { regions: REGIONS, effect: 'black', opacity: 50, format: 'png' },
    });
    expect(reds(await blobPixels(result.outputs[0]!.blob))).toEqual([
      [0, 5],
      [20, 15],
    ]);
    const other = await tool.run({
      files: [PNG()],
      options: {
        regions: '[{"x":50,"y":50,"w":50,"h":50,"effect":"black"}]',
        opacity: 50,
        format: 'png',
      },
    });
    // Only the bottom-right pixel is in that region: 30 blended halfway to 0.
    expect(reds(await blobPixels(other.outputs[0]!.blob))).toEqual([
      [0, 10],
      [20, 15],
    ]);
  });

  it('honours a per-region effect override', async () => {
    mock = installImageMock({ width: 2, height: 2, pixels: BASE_PIXELS, pixelOutput: true });
    const result = await tool.run({
      files: [PNG()],
      options: {
        regions: '[{"x":50,"y":50,"w":50,"h":50,"effect":"black"}]',
        effect: 'blur',
        radius: 4,
        format: 'png',
      },
    });
    const out = reds(await blobPixels(result.outputs[0]!.blob));
    expect(out[0]).toEqual([0, 10]);
    expect(out[1]).toEqual([20, 0]);
    expect(JSON.parse(result.report!.output).rows[0]![1]).toMatch(/black/i);
  });

  it('reports which metadata was dropped and how each region was drawn', async () => {
    mock = installImageMock({ width: 2, height: 2, pixels: BASE_PIXELS, pixelOutput: true });
    const result = await tool.run({
      files: [PNG('holiday.photo.png')],
      options: { regions: REGIONS, format: 'png' },
    });
    const report = JSON.parse(result.report!.output) as { headers: string[]; rows: string[][] };
    expect(report.headers).toEqual(['Region', 'Effect', 'Position · size', 'Pixels']);
    expect(report.rows[0]).toEqual(['1', 'Black (#000)', 'x 50%, y 0% · 1×2px', '2']);
    expect(result.report!.render).toBe('table');
    expect(result.notes!.join(' ')).toMatch(/EXIF, GPS, XMP, IPTC/);
    expect(result.notes!.join(' ')).toMatch(/baked into the exported pixels/i);
  });

  it('exports JPEG and WebP with the right extension and quality', async () => {
    mock = installImageMock({ width: 2, height: 2, pixels: BASE_PIXELS });
    const jpeg = await tool.run({
      files: [PNG('holiday.png')],
      options: { regions: REGIONS, format: 'jpeg', quality: 80 },
    });
    expect(jpeg.outputs[0]!.filename).toBe('holiday-redacted.jpg');
    const jpegCall = mock.canvases[0]!.encodes.at(-1)!;
    expect(jpegCall.type).toBe('image/jpeg');
    expect(jpegCall.quality).toBeCloseTo(0.8, 5);
    // JPEG has no alpha, so the canvas is flattened onto white first.
    expect(mock.canvases[0]!.fills.some((f) => f.style === '#ffffff')).toBe(true);

    const webp = await tool.run({
      files: [PNG('holiday.png')],
      options: { regions: REGIONS, format: 'webp', quality: 100 },
    });
    expect(webp.outputs[0]!.filename).toBe('holiday-redacted.webp');
    expect(mock.canvases[1]!.encodes.at(-1)!.type).toBe('image/webp');
  });

  it('ignores the quality option for PNG', async () => {
    mock = installImageMock({ width: 2, height: 2, pixels: BASE_PIXELS });
    await tool.run({ files: [PNG()], options: { regions: REGIONS, format: 'png', quality: 10 } });
    expect(mock.canvases[0]!.encodes[0]!.quality).toBeUndefined();
  });

  it('warns about a region that hangs off the edge and redacts the visible part', async () => {
    mock = installImageMock({ width: 2, height: 2, pixels: BASE_PIXELS, pixelOutput: true });
    const result = await tool.run({
      files: [PNG()],
      options: { regions: '[{"x":50,"y":50,"w":100,"h":100,"effect":"black"}]', format: 'png' },
    });
    expect(reds(await blobPixels(result.outputs[0]!.blob))).toEqual([
      [0, 10],
      [20, 0],
    ]);
  });

  it('warns about a region that cannot be drawn when others survive', async () => {
    mock = installImageMock({ width: 2, height: 2, pixels: BASE_PIXELS, pixelOutput: true });
    const result = await tool.run({
      files: [PNG()],
      options: {
        regions:
          '[{"x":50,"y":0,"w":50,"h":100,"effect":"black"},{"x":300,"y":300,"w":10,"h":10}]',
        format: 'png',
      },
    });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings![0]).toMatch(/photo\.png: Region 2 was skipped: it lies outside/i);
    expect(reds(await blobPixels(result.outputs[0]!.blob))).toEqual([
      [0, 0],
      [20, 0],
    ]);
  });

  it('rejects an unknown effect and a malformed region list', async () => {
    mock = installImageMock({ width: 2, height: 2, pixels: BASE_PIXELS });
    await expect(
      tool.run({ files: [PNG()], options: { regions: REGIONS, effect: 'smear' } }),
    ).rejects.toThrow(/not a redaction effect/i);
    await expect(
      tool.run({ files: [PNG()], options: { regions: '[{"x":0,' } }),
    ).rejects.toThrow(/not valid JSON/i);
  });

  it('decodes with EXIF orientation applied, so the rotation is baked in', async () => {
    mock = installImageMock({ width: 2, height: 2, pixels: BASE_PIXELS });
    await tool.run({ files: [PNG()], options: { regions: REGIONS } });
    expect(mock.bitmaps[0]!.options).toMatchObject({ imageOrientation: 'from-image' });
    expect(mock.bitmaps[0]!.closed).toBe(true);
  });

  it('falls back to a plain decode when the orientation option is unsupported', async () => {
    mock = installImageMock({
      width: 2,
      height: 2,
      pixels: BASE_PIXELS,
      rejectOrientation: true,
    });
    const result = await tool.run({ files: [PNG()], options: { regions: REGIONS } });
    expect(result.outputs).toHaveLength(1);
    expect(mock.bitmaps[0]!.options).toBeUndefined();
  });

  it('reports a friendly error for undecodable bytes', async () => {
    mock = installImageMock({ failDecode: true });
    await expect(tool.run({ files: [PNG()], options: { regions: REGIONS } })).rejects.toThrow(
      /could not be decoded/i,
    );
  });

  it('refuses an image that is too large to process safely', async () => {
    mock = installImageMock({ width: 20_000, height: 20_000 });
    await expect(tool.run({ files: [PNG()], options: { regions: REGIONS } })).rejects.toThrow(
      /too large to process safely/i,
    );
    expect(mock.canvases).toHaveLength(0);
  });

  it('reports progress from start to finish', async () => {
    mock = installImageMock({ width: 2, height: 2, pixels: BASE_PIXELS });
    const onProgress = vi.fn();
    await tool.run({ files: [PNG()], options: { regions: REGIONS }, onProgress });
    expect(onProgress).toHaveBeenCalled();
    const [lastFraction, lastMessage] = onProgress.mock.calls.at(-1)!;
    expect(lastFraction).toBe(1);
    expect(lastMessage).toBe('Done');
    expect(onProgress.mock.calls.some(([f, m]) => f === 0.5 && /Encoding/.test(String(m)))).toBe(
      true,
    );
  });

  it('cancels when the signal is already aborted', async () => {
    mock = installImageMock({ width: 2, height: 2, pixels: BASE_PIXELS });
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({ files: [PNG()], options: { regions: REGIONS }, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(mock.canvases).toHaveLength(0);
  });
});
