import { describe, expect, it } from 'vitest';
import tool, { quantizePixels } from './image-palette.tool';

function hex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

describe('quantizePixels', () => {
  it('clamps and caps the requested colour count', () => {
    const one = [255, 0, 0, 255];
    expect(quantizePixels(one, 1)).toEqual(['#ff0000']);
    // 16x16 bucketing rounds 254->256 then clamps to 255
    const c = quantizePixels([255, 255, 255, 255], 3);
    expect(c.length).toBeLessThanOrEqual(3);
    expect(c[0]).toBe(hex(255, 255, 255));
  });
  it('respects the most-frequent and median-cut algorithms', () => {
    const pixels = [255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255];
    expect(quantizePixels(pixels, 2, 'most-frequent')).toContain('#ff0000');
    expect(quantizePixels(pixels, 2, 'median-cut')).toContain('#ff0000');
  });
  it('returns an empty palette for fully transparent pixels', () => {
    expect(quantizePixels([10, 20, 30, 0], 4)).toEqual([]);
  });
});

describe('image-palette run', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });
});
