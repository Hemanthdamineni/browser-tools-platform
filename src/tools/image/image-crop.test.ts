import { describe, expect, it } from 'vitest';
import tool, { cropRect } from './image-crop.tool';

describe('cropRect', () => {
  it('calculates center and anchored aspect crops', () => {
    expect(cropRect(400, 200, { mode: 'aspect', aspect: '1:1', anchor: 'center' })).toEqual({ x: 100, y: 0, w: 200, h: 200 });
    expect(cropRect(400, 200, { mode: 'aspect', aspect: '1:1', anchor: 'right' })).toEqual({ x: 200, y: 0, w: 200, h: 200 });
  });
  it('floors and clips explicit crop rectangles to image bounds', () => {
    expect(cropRect(100, 80, { mode: 'pixels', x: 10.8, y: 5.3, cropWidth: 200, cropHeight: 30.9 })).toEqual({ x: 10, y: 5, w: 90, h: 30 });
  });
  it('rejects invalid ratios and zero/outside pixel crops', () => {
    expect(() => cropRect(10, 10, { aspect: '0:1' })).toThrow(/valid aspect ratio/i);
    expect(() => cropRect(10, 10, { mode: 'pixels', x: 10, y: 0, cropWidth: 1, cropHeight: 2 })).toThrow(/outside the image/i);
  });
});

describe('image-crop run', () => {
  it('rejects a selection containing no image', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });
});
