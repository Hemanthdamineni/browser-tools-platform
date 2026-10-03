import { describe, expect, it } from 'vitest';
import tool, { layoutSprites } from './image-spritesheet.tool';

describe('layoutSprites', () => {
  const sprites = [
    { name: 'a', w: 10, h: 20 },
    { name: 'b', w: 30, h: 10 },
  ];
  it('places items horizontally and vertically with padding', () => {
    expect(layoutSprites(sprites, 'horizontal', 0, 2)).toEqual({
      positions: [
        { name: 'a', x: 0, y: 0, w: 10, h: 20 },
        { name: 'b', x: 12, y: 0, w: 30, h: 10 },
      ],
      width: 42,
      height: 20,
    });
    expect(layoutSprites(sprites, 'vertical', 0, 2)).toEqual({
      positions: [
        { name: 'a', x: 0, y: 0, w: 10, h: 20 },
        { name: 'b', x: 0, y: 22, w: 30, h: 10 },
      ],
      width: 30,
      height: 32,
    });
  });
  it('uses a grid cell size based on largest sprite dimensions', () => {
    expect(layoutSprites(sprites, 'grid', 2, 1)).toEqual({
      positions: [
        { name: 'a', x: 0, y: 0, w: 10, h: 20 },
        { name: 'b', x: 31, y: 0, w: 30, h: 10 },
      ],
      width: 61,
      height: 20,
    });
  });
  it('rejects an empty layout', () => {
    expect(() => layoutSprites([], 'grid', 0, 0)).toThrow(/at least one image/i);
  });
  it('normalizes malformed padding and rejects invalid or oversized dimensions', () => {
    expect(layoutSprites([{ name: 'a', w: 10, h: 10 }], 'horizontal', 0, NaN)).toMatchObject({
      width: 10,
      height: 10,
    });
    expect(() => layoutSprites([{ name: 'bad', w: Infinity, h: 10 }], 'grid', 0, 0)).toThrow(
      /positive finite dimensions/i,
    );
    expect(() => layoutSprites([{ name: 'huge', w: 40_000, h: 1 }], 'grid', 0, 0)).toThrow(
      /too large/i,
    );
  });
});

describe('image-spritesheet run', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });
});
