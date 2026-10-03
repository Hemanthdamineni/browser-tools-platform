import { describe, expect, it } from 'vitest';
import tool, { comparePixels } from './image-diff.tool';

describe('comparePixels', () => {
  it('counts thresholded per-pixel RGB differences and summarizes deltas', () => {
    expect(comparePixels([0, 0, 0, 255, 10, 20, 30, 255], [30, 20, 10, 0, 12, 20, 30, 255], 5)).toEqual({
      pixels: 2, differing: 1, percent: 50, mean: 16, max: 30, deltas: [30, 2],
    });
  });
  it('ignores alpha and handles empty pixel arrays', () => {
    expect(comparePixels([1, 2, 3, 0], [1, 2, 3, 255], 0)).toMatchObject({ differing: 0, mean: 0, max: 0 });
    expect(comparePixels([], [], 10)).toEqual({ pixels: 0, differing: 0, percent: 0, mean: 0, max: 0, deltas: [] });
  });
});

describe('image-diff run', () => {
  it('requires exactly two images', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/exactly two images/i);
  });
  it('rejects non-image files', async () => {
    const file = new File(['x'], 'note.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [file, file], options: {} })).rejects.toThrow(/not an image/i);
  });
});
