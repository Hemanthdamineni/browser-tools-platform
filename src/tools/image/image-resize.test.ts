import { describe, it, expect } from 'vitest';
import tool, { computeTargetSize } from './image-resize.tool';

describe('computeTargetSize', () => {
  it('fits 4000×2000 within 800×600 preserving aspect', () => {
    expect(computeTargetSize(4000, 2000, { mode: 'fit', width: 800, height: 600 })).toEqual({
      w: 800,
      h: 400,
    });
  });
  it('scales percent 50 of 100×100 to 50×50', () => {
    expect(computeTargetSize(100, 100, { mode: 'percent', percent: 50 })).toEqual({ w: 50, h: 50 });
  });
  it('max-width of 400×300 without upscale stays 400×300', () => {
    expect(computeTargetSize(400, 300, { mode: 'max-width', width: 800 })).toEqual({
      w: 400,
      h: 300,
    });
  });
  it('max-width downscales when the limit is smaller', () => {
    expect(computeTargetSize(1000, 500, { mode: 'max-width', width: 400 })).toEqual({
      w: 400,
      h: 200,
    });
  });
  it('exact ignores aspect ratio', () => {
    expect(computeTargetSize(1000, 1000, { mode: 'exact', width: 300, height: 150 })).toEqual({
      w: 300,
      h: 150,
    });
  });
  it('does not upscale in fill mode by default', () => {
    expect(computeTargetSize(100, 100, { mode: 'fill', width: 200, height: 100 })).toEqual({
      w: 100,
      h: 100,
    });
  });
  it('never returns a zero dimension', () => {
    const r = computeTargetSize(1, 1, { mode: 'percent', percent: 1 });
    expect(r.w).toBeGreaterThanOrEqual(1);
    expect(r.h).toBeGreaterThanOrEqual(1);
  });
  it('falls back to defaults for malformed numeric options', () => {
    expect(computeTargetSize(100, 100, { mode: 'percent', percent: NaN })).toEqual({
      w: 50,
      h: 50,
    });
    expect(computeTargetSize(100, 100, { mode: 'exact', width: NaN, height: NaN })).toEqual({
      w: 800,
      h: 600,
    });
  });
  it('rejects invalid source dimensions', () => {
    expect(() => computeTargetSize(NaN, 100, {})).toThrow(/positive finite numbers/i);
    expect(() => computeTargetSize(100, 0, {})).toThrow(/positive finite numbers/i);
  });
});

describe('image-resize run', () => {
  it('rejects when no file is provided', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });
  it('rejects a non-image file', async () => {
    const f = new File(['x'], 'a.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [f], options: {} })).rejects.toThrow(/not an image/i);
  });
});
