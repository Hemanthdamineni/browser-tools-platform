import { describe, expect, it } from 'vitest';
import tool, { icoEntries, resizeMath } from './favicon-generator.tool';

describe('icoEntries', () => {
  it('writes ICO directory entries and appends image payloads', () => {
    const result = icoEntries([new Uint8Array([10, 11]), new Uint8Array([12])], [16, 32]);
    const view = new DataView(result.buffer);
    expect([view.getUint16(0, true), view.getUint16(2, true), view.getUint16(4, true)]).toEqual([
      0, 1, 2,
    ]);
    expect(result[6]).toBe(16);
    expect(view.getUint32(14, true)).toBe(2); // first entry payload size
    expect(view.getUint32(18, true)).toBe(38); // first entry payload offset
    expect(view.getUint32(30, true)).toBe(1); // second entry payload size
    expect(view.getUint32(34, true)).toBe(40); // second entry payload offset
    expect([...result.slice(38)]).toEqual([10, 11, 12]);
  });
});

describe('resizeMath', () => {
  it('fits a landscape image inside the icon bounds and centers it', () => {
    expect(resizeMath(200, 100, 100, 0)).toEqual({ x: 0, y: 25, w: 100, h: 50 });
  });
  it('applies inner padding while preserving aspect ratio', () => {
    expect(resizeMath(100, 100, 100, 10)).toEqual({ x: 10, y: 10, w: 80, h: 80 });
  });
});

describe('favicon-generator run', () => {
  it('rejects missing image input', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });
});
