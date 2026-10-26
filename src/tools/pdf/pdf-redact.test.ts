import { describe, expect, it } from 'vitest';
import {
  MAX_REDACT_SCALE,
  MIN_REDACT_PERCENT,
  MIN_REDACT_SCALE,
  describePages,
  pagePixelSize,
  parseRedactPlan,
  regionToPixels,
  type RedactEntry,
} from './pdf-redact.tool';
import { ToolError } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Plan parsing and validation                                                */
/* -------------------------------------------------------------------------- */

describe('parseRedactPlan', () => {
  it('parses the pages that carry rectangles', () => {
    const plan = parseRedactPlan(
      JSON.stringify([
        { page: 2, regions: [{ x: 10, y: 10, w: 20, h: 15 }] },
        { page: 5, regions: [{ x: 30, y: 30, w: 40, h: 40 }] },
      ]),
      6,
    );
    expect(plan).toEqual([
      { page: 2, regions: [{ x: 10, y: 10, w: 20, h: 15 }] },
      { page: 5, regions: [{ x: 30, y: 30, w: 40, h: 40 }] },
    ]);
  });

  it('returns an empty plan when there is nothing to redact', () => {
    expect(parseRedactPlan('', 3)).toEqual([]);
    expect(parseRedactPlan('[]', 3)).toEqual([]);
    expect(parseRedactPlan(null, 3)).toEqual([]);
  });

  it('drops an entry with no rectangles at all', () => {
    const plan = parseRedactPlan(
      JSON.stringify([
        { page: 1, regions: [] },
        { page: 3, regions: [{ x: 10, y: 10, w: 20, h: 20 }] },
      ]),
      3,
    );
    expect(plan.map((entry) => entry.page)).toEqual([3]);
  });

  it('merges two entries for the same page', () => {
    const plan = parseRedactPlan(
      JSON.stringify([
        { page: 2, regions: [{ x: 0, y: 0, w: 10, h: 10 }] },
        { page: 2, regions: [{ x: 50, y: 50, w: 10, h: 10 }] },
      ]),
      2,
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]!.regions).toHaveLength(2);
  });

  it('rejects invalid JSON, a non-array and a missing page number', () => {
    expect(() => parseRedactPlan('{', 3)).toThrow(/not valid JSON/);
    expect(() => parseRedactPlan('{}', 3)).toThrow(/JSON array/);
    expect(() => parseRedactPlan('[{"regions":[]}]', 3)).toThrow(/no page number/);
    expect(() =>
      parseRedactPlan('[{"page":1,"regions":[{"x":"bad","y":0,"w":1,"h":1}]}]', 3),
    ).toThrow(/not a number/);
  });

  it('rejects a page outside the document', () => {
    const err = (() => {
      try {
        parseRedactPlan('[{"page":9,"regions":[{"x":0,"y":0,"w":5,"h":5}]}]', 3);
      } catch (e) {
        return e;
      }
      return null;
    })();
    expect(err).toBeInstanceOf(ToolError);
    expect((err as ToolError).message).toMatch(/page 9/);
    expect((err as ToolError).message).toMatch(/3 pages/);
  });

  it('clamps the rectangles it returns', () => {
    const plan = parseRedactPlan(
      '[{"page":1,"regions":[{"x":-20,"y":95,"w":20,"h":30}]}]',
      1,
    ) as RedactEntry[];
    expect(plan[0]!.regions[0]).toEqual({ x: 0, y: 70, w: 20, h: 30 });
  });
});

/* -------------------------------------------------------------------------- */
/*  Geometry: PDF points to rendered pixels at a known DPI/scale               */
/* -------------------------------------------------------------------------- */

describe('page geometry', () => {
  it('prints a page at a known scale (72 dpi is 1 px per point)', () => {
    // Letter.
    expect(pagePixelSize(612, 792, 0, 1)).toEqual({ width: 612, height: 792 });
    // 144 dpi.
    expect(pagePixelSize(612, 792, 0, 2)).toEqual({ width: 1224, height: 1584 });
  });

  it('swaps the axes of a page turned a quarter turn', () => {
    expect(pagePixelSize(612, 792, 90, 1)).toEqual({ width: 792, height: 612 });
    expect(pagePixelSize(612, 792, 270, 2)).toEqual({ width: 1584, height: 1224 });
    expect(pagePixelSize(612, 792, 180, 1)).toEqual({ width: 612, height: 792 });
  });

  it('maps a percent rectangle onto rendered pixels', () => {
    // A letter page at 2 px/pt: 1224 × 1584. A half-page-wide, 10%-tall box at the top.
    expect(regionToPixels({ x: 0, y: 0, w: 50, h: 10 }, 1224, 1584)).toEqual({
      x: 0,
      y: 0,
      w: 612,
      h: 158,
    });
    expect(regionToPixels({ x: 10, y: 20, w: 30, h: 40 }, 1000, 500)).toEqual({
      x: 100,
      y: 100,
      w: 300,
      h: 200,
    });
  });

  it('clips to the page and rejects a degenerate rectangle', () => {
    expect(regionToPixels({ x: 90, y: 90, w: 40, h: 40 }, 200, 200)).toEqual({
      x: 180,
      y: 180,
      w: 20,
      h: 20,
    });
    expect(regionToPixels({ x: 0, y: 0, w: 0, h: 10 }, 200, 200)).toBeNull();
    expect(regionToPixels({ x: 120, y: 0, w: 10, h: 10 }, 200, 200)).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/*  Scale constants and the page-list description                              */
/* -------------------------------------------------------------------------- */

describe('constants and descriptions', () => {
  it('limits the rasterisation scale', () => {
    expect(MIN_REDACT_SCALE).toBe(1);
    expect(MAX_REDACT_SCALE).toBe(4);
    expect(MIN_REDACT_PERCENT).toBe(1);
  });

  it('describes the redacted pages for the warning', () => {
    expect(describePages([])).toBe('none');
    expect(describePages([1])).toBe('1');
    expect(describePages([1, 3])).toBe('1 and 3');
    expect(describePages([1, 3, 5])).toBe('1, 3 and 5');
  });
});
