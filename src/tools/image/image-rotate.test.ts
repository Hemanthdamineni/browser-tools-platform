import { describe, expect, it } from 'vitest';
import tool, { outputSize } from './image-rotate.tool';

describe('outputSize', () => {
  it('swaps dimensions for 90/270 degree rotation', () => {
    expect(outputSize(200, 100, '90')).toEqual({ w: 100, h: 200 });
    expect(outputSize(200, 100, 270)).toEqual({ w: 100, h: 200 });
  });
  it('keeps dimensions for 0/180 rotation', () => {
    expect(outputSize(200, 100, 0)).toEqual({ w: 200, h: 100 });
    expect(outputSize(200, 100, '180')).toEqual({ w: 200, h: 100 });
  });
});

describe('image-rotate run', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });
});
