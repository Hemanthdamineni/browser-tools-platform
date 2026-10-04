import { describe, it, expect } from 'vitest';
import { computeTargetSize } from './image-resize.tool';

const base = {
  mode: 'fit',
  width: 800,
  height: 600,
  percent: 50,
  upscale: false,
} as const;

describe('computeTargetSize', () => {
  it('fit contains landscape within the box', () => {
    expect(computeTargetSize(4000, 2000, { ...base })).toEqual({
      width: 800,
      height: 400,
      limited: false,
    });
  });

  it('fit scales portrait to height and keeps aspect', () => {
    expect(computeTargetSize(1000, 3000, { ...base })).toEqual({
      width: 200,
      height: 600,
      limited: false,
    });
  });

  it('fit never upscales small images when upscaling is off', () => {
    expect(computeTargetSize(400, 300, { ...base })).toEqual({
      width: 400,
      height: 300,
      limited: true,
    });
  });

  it('fit round-trips exact source dimensions as unchanged', () => {
    expect(computeTargetSize(800, 600, { ...base })).toEqual({
      width: 800,
      height: 600,
      limited: false,
    });
  });

  it('percent 50 of 100x100 gives 50x50', () => {
    expect(computeTargetSize(100, 100, { ...base, mode: 'percent', percent: 50 })).toEqual({
      width: 50,
      height: 50,
      limited: false,
    });
  });

  it('percent clamps to the 1..400 range', () => {
    expect(computeTargetSize(100, 100, { ...base, mode: 'percent', percent: 0 })).toEqual({
      width: 1,
      height: 1,
      limited: false,
    });
  });

  it('max-width clamps without enlarging', () => {
    expect(computeTargetSize(400, 300, { ...base, mode: 'max-width', width: 800 })).toEqual({
      width: 400,
      height: 300,
      limited: true,
    });
  });

  it('max-width downscales narrow when width target is smaller', () => {
    expect(computeTargetSize(1000, 500, { ...base, mode: 'max-width', width: 800 })).toEqual({
      width: 800,
      height: 400,
      limited: false,
    });
  });

  it('max-height clamps height and preserves aspect', () => {
    expect(computeTargetSize(800, 1200, { ...base, mode: 'max-height', height: 600 })).toEqual({
      width: 400,
      height: 600,
      limited: false,
    });
  });

  it('exact stretches to the given dimensions', () => {
    expect(computeTargetSize(100, 100, { ...base, mode: 'exact', width: 200, height: 150 })).toEqual({
      width: 200,
      height: 150,
      limited: false,
    });
  });

  it('fill covers the box and crops (upscale on)', () => {
    expect(
      computeTargetSize(400, 100, { ...base, mode: 'fill', upscale: true }),
    ).toEqual({ width: 800, height: 600, limited: false });
  });

  it('fill never upscales when upscaling is off', () => {
    expect(computeTargetSize(400, 100, { ...base, mode: 'fill' })).toEqual({
      width: 133,
      height: 100,
      limited: true,
    });
  });

  it('throws on non-positive source', () => {
    expect(() => computeTargetSize(0, 10, { ...base })).toThrow();
  });
});
