import { describe, expect, it } from 'vitest';
import { PDFDocument, degrees } from 'pdf-lib';
import { ToolError } from '@/lib/types';
import {
  DEFAULT_BLANK_SIZE,
  MAX_PLAN_PAGES,
  PAGE_SIZES,
  assembleInto,
  normalizeRotation,
  parsePlan,
  planToJson,
  resolveBlankSize,
  type PlanEntry,
} from './pdf-organize.core';

/** A source document whose pages have different sizes, so order is observable. */
async function sourcePdf(pageCount = 3): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([100 + i * 10, 200]);
  return doc;
}

/** Assemble a plan into a fresh document and return its bytes. */
async function build(
  source: PDFDocument,
  plan: PlanEntry[],
  onProgress?: (fraction: number, message: string) => void,
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  await assembleInto(out, source, plan, onProgress);
  return out.save();
}

describe('normalizeRotation', () => {
  it('accepts every quarter turn', () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(180)).toBe(180);
    expect(normalizeRotation(270)).toBe(270);
  });

  it('normalises full turns and negative turns', () => {
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(-450)).toBe(270);
  });

  it('accepts numeric strings', () => {
    expect(normalizeRotation('90')).toBe(90);
    expect(normalizeRotation('180')).toBe(180);
  });

  it('rejects a rotation that is not a multiple of 90', () => {
    expect(() => normalizeRotation(45)).toThrow(ToolError);
    expect(() => normalizeRotation(45)).toThrow(/not a whole turn/);
    expect(() => normalizeRotation(90.5)).toThrow(ToolError);
  });

  it('rejects an unreadable rotation', () => {
    expect(() => normalizeRotation('sideways')).toThrow(ToolError);
    expect(() => normalizeRotation(Number.NaN)).toThrow(ToolError);
    expect(() => normalizeRotation(undefined)).toThrow(ToolError);
  });

  it('names the offending position', () => {
    expect(() => normalizeRotation(45, 3)).toThrow(/Page 3 of the plan/);
  });
});

describe('resolveBlankSize', () => {
  it('resolves every known size', () => {
    for (const id of Object.keys(PAGE_SIZES)) {
      expect(resolveBlankSize(id).id).toBe(id);
    }
    expect(resolveBlankSize('A4').id).toBe('a4');
    expect(resolveBlankSize(' a4 ').id).toBe('a4');
  });

  it('rejects a missing or unknown size', () => {
    expect(() => resolveBlankSize(undefined)).toThrow(ToolError);
    expect(() => resolveBlankSize('')).toThrow(/no page size/);
    expect(() => resolveBlankSize('a3')).toThrow(/no page size/);
    expect(() => resolveBlankSize('a3', 2)).toThrow(/Blank page 2/);
  });

  it('defaults to A4 portrait', () => {
    expect(resolveBlankSize(DEFAULT_BLANK_SIZE).width).toBeCloseTo(595.28, 2);
    expect(resolveBlankSize(DEFAULT_BLANK_SIZE).height).toBeCloseTo(841.89, 2);
  });
});

describe('parsePlan', () => {
  it('keeps every page in order for "all"', () => {
    const plan = parsePlan('all', 3);
    expect(plan).toEqual([
      { source: 1, rotate: 0, blank: false },
      { source: 2, rotate: 0, blank: false },
      { source: 3, rotate: 0, blank: false },
    ]);
  });

  it('accepts "ALL" in any case', () => {
    expect(parsePlan('ALL', 2)).toHaveLength(2);
    expect(parsePlan(' all ', 2)).toHaveLength(2);
  });

  it('parses a reordered plan with rotations', () => {
    const plan = parsePlan('[{"source":3,"rotate":90},{"source":1,"rotate":180}]', 3);
    expect(plan).toEqual([
      { source: 3, rotate: 90, blank: false },
      { source: 1, rotate: 180, blank: false },
    ]);
  });

  it('rejects invalid JSON', () => {
    expect(() => parsePlan('{not json', 3)).toThrow(ToolError);
    expect(() => parsePlan('{not json', 3)).toThrow(/not valid JSON/);
  });

  it('rejects an empty plan', () => {
    expect(() => parsePlan('', 3)).toThrow(/plan is empty/);
    expect(() => parsePlan('   ', 3)).toThrow(/plan is empty/);
    expect(() => parsePlan('[]', 3)).toThrow(/plan is empty/);
  });

  it('rejects a plan that is not an array', () => {
    expect(() => parsePlan('{"source":1}', 3)).toThrow(/must be a JSON array/);
    expect(() => parsePlan('3', 3)).toThrow(/must be a JSON array/);
    expect(() => parsePlan('null', 3)).toThrow(/must be a JSON array/);
  });

  it('rejects an entry that is not a page', () => {
    expect(() => parsePlan('[null]', 3)).toThrow(/is not a page/);
    expect(() => parsePlan('["1"]', 3)).toThrow(/is not a page/);
    expect(() => parsePlan('[[1]]', 3)).toThrow(/is not a page/);
  });

  it('rejects a page index outside the document', () => {
    expect(() => parsePlan('[{"source":0}]', 3)).toThrow(/outside this PDF \(1–3\)/);
    expect(() => parsePlan('[{"source":4}]', 3)).toThrow(/outside this PDF \(1–3\)/);
    expect(() => parsePlan('[{"source":-1}]', 3)).toThrow(/outside this PDF/);
  });

  it('rejects a source page that is not a whole number', () => {
    expect(() => parsePlan('[{"source":1.5}]', 3)).toThrow(/not a whole page number/);
    expect(() => parsePlan('[{"source":"two"}]', 3)).toThrow(/not a whole page number/);
  });

  it('rejects the same source page twice', () => {
    expect(() => parsePlan('[{"source":2},{"source":2}]', 3)).toThrow(/in the plan twice/);
  });

  it('rejects a rotation that is not a multiple of 90', () => {
    expect(() => parsePlan('[{"source":1,"rotate":45}]', 3)).toThrow(/not a whole turn/);
  });

  it('rejects a blank page without a size', () => {
    expect(() => parsePlan('[{"blank":true}]', 3, '')).toThrow(/no page size/);
    expect(() => parsePlan('[{"blank":true}]', 3, undefined)).toThrow(/no page size/);
  });

  it('rejects a blank page with an unknown size', () => {
    expect(() => parsePlan('[{"blank":true,"size":"a3"}]', 3)).toThrow(/no page size/);
  });

  it('accepts a blank page with its own size', () => {
    const plan = parsePlan('[{"blank":true,"size":"letter"}]', 3);
    expect(plan).toEqual([{ rotate: 0, blank: true, size: 'letter' }]);
  });

  it('falls back to the blankSize option', () => {
    const plan = parsePlan('[{"blank":true}]', 3, 'a4-landscape');
    expect(plan).toEqual([{ rotate: 0, blank: true, size: 'a4-landscape' }]);
  });

  it('rejects a blank page that also names a source page', () => {
    expect(() => parsePlan('[{"blank":true,"source":1}]', 3)).toThrow(/must not also point/);
  });

  it('rejects a page with neither a source nor the blank flag', () => {
    expect(() => parsePlan('[{}]', 3)).toThrow(/does not point at a source page/);
    expect(() => parsePlan('[{"rotate":90}]', 3)).toThrow(/does not point at a source page/);
  });

  it('rejects a plan with more pages than the limit', () => {
    const many = JSON.stringify(
      Array.from({ length: MAX_PLAN_PAGES + 1 }, (_, i) => ({ source: (i % 3) + 1 })),
    );
    expect(() => parsePlan(many, 3)).toThrow(/too many for one PDF/);
  });

  it('rejects a document without pages', () => {
    expect(() => parsePlan('all', 0)).toThrow(/no pages to organise/);
  });
});

describe('planToJson', () => {
  it('round-trips a plan', () => {
    const plan = parsePlan('[{"source":2,"rotate":90},{"blank":true,"size":"letter"}]', 3);
    expect(parsePlan(planToJson(plan), 3)).toEqual(plan);
  });

  it('writes a size for every blank page', () => {
    const json = planToJson([{ rotate: 0, blank: true, size: 'a4' }]);
    expect(JSON.parse(json)).toEqual([{ rotate: 0, blank: true, size: 'a4' }]);
  });

  it('falls back to the default size for a blank page without one', () => {
    const json = planToJson([{ rotate: 0, blank: true }]);
    expect(JSON.parse(json)).toEqual([{ rotate: 0, blank: true, size: 'a4' }]);
  });
});

describe('assembleInto', () => {
  it('rebuilds the document with the planned page count', async () => {
    const source = await sourcePdf(3);
    const plan = parsePlan('[{"source":1},{"source":2}]', 3);
    const bytes = await build(source, plan);
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(2);
  });

  it('keeps the planned order', async () => {
    const source = await sourcePdf(3);
    const plan = parsePlan('[{"source":3},{"source":1},{"source":2}]', 3);
    const bytes = await build(source, plan);
    const out = await PDFDocument.load(bytes);
    const widths = out.getPages().map((page) => Math.round(page.getWidth()));
    expect(widths).toEqual([120, 100, 110]);
  });

  it('applies the planned rotation on top of the page rotation', async () => {
    const source = await sourcePdf(1);
    source.getPage(0).setRotation(degrees(90));
    const plan = parsePlan('[{"source":1,"rotate":90}]', 1);
    const bytes = await build(source, plan);
    const out = await PDFDocument.load(bytes);
    expect(out.getPage(0).getRotation().angle).toBe(180);
  });

  it('applies multiple rotations independently', async () => {
    const source = await sourcePdf(3);
    const plan = parsePlan(
      '[{"source":2,"rotate":90},{"source":1,"rotate":180},{"source":3,"rotate":270}]',
      3,
    );
    const bytes = await build(source, plan);
    const out = await PDFDocument.load(bytes);
    expect(out.getPage(0).getRotation().angle).toBe(90);
    expect(out.getPage(1).getRotation().angle).toBe(180);
    expect(out.getPage(2).getRotation().angle).toBe(270);
  });

  it('inserts blank pages at the start, middle and end', async () => {
    const source = await sourcePdf(2);
    const plan = parsePlan(
      '[{"blank":true,"size":"letter"},{"source":1},{"blank":true,"size":"a4-landscape"},{"source":2},{"blank":true,"size":"a4"}]',
      2,
    );
    const bytes = await build(source, plan);
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(5);
    expect(Math.round(out.getPage(0).getWidth())).toBe(612); // letter, start
    expect(Math.round(out.getPage(1).getWidth())).toBe(100); // source 1
    expect(Math.round(out.getPage(2).getWidth())).toBe(842); // a4 landscape, middle
    expect(Math.round(out.getPage(3).getWidth())).toBe(110); // source 2
    expect(Math.round(out.getPage(4).getWidth())).toBe(595); // default a4, end
  });

  it('produces a readable PDF', async () => {
    const source = await sourcePdf(2);
    const bytes = await build(source, parsePlan('all', 2));
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(2);
  });

  it('rejects an empty plan', async () => {
    const source = await sourcePdf(1);
    await expect(build(source, [])).rejects.toThrow(ToolError);
  });

  it('reports progress for every page', async () => {
    const source = await sourcePdf(2);
    const seen: number[] = [];
    await build(source, parsePlan('all', 2), (fraction) => seen.push(fraction));
    expect(seen).toEqual([0.5, 1]);
  });
});
