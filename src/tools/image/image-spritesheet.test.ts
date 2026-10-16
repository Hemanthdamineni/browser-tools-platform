import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import tool, { layoutSprites } from './image-spritesheet.tool';
import {
  imageFile,
  installFakeImageEnv,
  resetFakeImageEnv,
  setFakeBlobType,
  setFakeDecoder,
  solidImage,
} from './test-canvas';

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
  it('shelf-packs sprites into rows', () => {
    expect(layoutSprites(sprites, 'packed', 0, 2)).toEqual({
      positions: [
        { name: 'a', x: 0, y: 0, w: 10, h: 20 },
        { name: 'b', x: 0, y: 22, w: 30, h: 10 },
      ],
      width: 30,
      height: 32,
    });
  });
  it('produces a packed sheet with no overlapping sprites', () => {
    const sizes: [number, number][] = [
      [10, 10],
      [40, 20],
      [15, 30],
      [5, 5],
      [20, 20],
    ];
    const layout = layoutSprites(
      sizes.map(([w, h], i) => ({ name: `s${i}`, w, h })),
      'packed',
      0,
      1,
    );
    for (let i = 0; i < layout.positions.length; i++) {
      for (let j = i + 1; j < layout.positions.length; j++) {
        const a = layout.positions[i]!;
        const b = layout.positions[j]!;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    }
    expect(layout.positions.every((p) => p.x >= 0 && p.y >= 0)).toBe(true);
  });
  it('rejects an empty layout', () => {
    expect(() => layoutSprites([], 'grid', 0, 0)).toThrow(/at least one image/i);
  });
  it('normalizes malformed padding and rejects invalid or oversized dimensions', () => {
    expect(layoutSprites([{ name: 'a', w: 10, h: 10 }], 'horizontal', 0, Number.NaN)).toMatchObject(
      {
        width: 10,
        height: 10,
      },
    );
    expect(() => layoutSprites([{ name: 'bad', w: Infinity, h: 10 }], 'grid', 0, 0)).toThrow(
      /positive finite dimensions/i,
    );
    expect(() => layoutSprites([{ name: 'huge', w: 40_000, h: 1 }], 'grid', 0, 0)).toThrow(
      /too large/i,
    );
  });
});

describe('image-spritesheet run', () => {
  beforeEach(() => installFakeImageEnv());
  afterEach(() => resetFakeImageEnv());

  const img = (name: string, w: number, h: number) =>
    imageFile(name, solidImage(w, h, [10, 20, 30, 255]));
  const readRows = (output: string | undefined) => JSON.parse(output ?? '{}').rows as string[][];

  it('builds a grid sheet with a JSON + CSS report', async () => {
    const result = await tool.run({
      files: [img('a.png', 10, 10), img('b.png', 40, 20), img('c.png', 15, 30)],
      options: {},
    });
    expect(result.outputs[0]!.filename).toBe('spritesheet.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');
    expect(result.report?.render).toBe('table');
    const rows = readRows(result.report?.output);
    expect(rows[0]![0]).toContain('"sprites"');
    expect(rows[0]![1]).toContain('.sprite-a');
    // default grid: cols = ceil(sqrt(3)) = 2, cell = 40x30, padding = 2
    expect(result.stats).toMatchObject({ sprites: 3, width: 82, height: 62 });
  });

  it('supports horizontal, vertical and packed layouts', async () => {
    const files = () => [img('a.png', 10, 20), img('b.png', 30, 10)];
    const horizontal = await tool.run({
      files: files(),
      options: { layout: 'horizontal', padding: 2 },
    });
    expect(horizontal.stats).toMatchObject({ sprites: 2, width: 42, height: 20 });
    const vertical = await tool.run({
      files: files(),
      options: { layout: 'vertical', padding: 2 },
    });
    expect(vertical.stats).toMatchObject({ sprites: 2, width: 30, height: 32 });
    const packed = await tool.run({ files: files(), options: { layout: 'packed', padding: 2 } });
    expect(packed.stats).toMatchObject({ sprites: 2, width: 30, height: 32 });
  });

  it('honours the grid columns option', async () => {
    const result = await tool.run({
      files: [img('a.png', 10, 20), img('b.png', 30, 10)],
      options: { layout: 'grid', columns: 1, padding: 0 },
    });
    expect(result.stats).toMatchObject({ sprites: 2, width: 30, height: 40 });
  });

  it('handles multi-file batches', async () => {
    const files = Array.from({ length: 5 }, (_, i) => img(`sprite-${i}.png`, 8 + i, 8 + i));
    const result = await tool.run({ files, options: { layout: 'horizontal', padding: 1 } });
    expect(result.stats?.sprites).toBe(5);
  });

  it('disambiguates duplicate sprite names', async () => {
    const result = await tool.run({
      files: [img('a.png', 5, 5), img('a.jpg', 5, 5)],
      options: { layout: 'horizontal', padding: 1 },
    });
    const rows = readRows(result.report?.output);
    const json = JSON.parse(rows[0]![0]!) as { sprites: { name: string }[] };
    expect(json.sprites.map((sprite) => sprite.name)).toEqual(['a', 'a-1']);
  });

  it('sanitizes sprite names used as CSS classes', async () => {
    const result = await tool.run({ files: [img('my icon@2x.png', 5, 5)], options: {} });
    const rows = readRows(result.report?.output);
    expect(rows[0]![1]).toContain('.sprite-my-icon-2x');
  });

  it('exports WebP when requested', async () => {
    const result = await tool.run({ files: [img('a.png', 5, 5)], options: { format: 'webp' } });
    expect(result.outputs[0]!.filename).toBe('spritesheet.webp');
    expect(result.outputs[0]!.blob.type).toBe('image/webp');
  });

  it('reports a friendly error when the browser cannot encode WebP', async () => {
    setFakeBlobType('image/png');
    await expect(
      tool.run({ files: [img('a.png', 5, 5)], options: { format: 'webp' } }),
    ).rejects.toThrow(/cannot encode image\/webp/i);
  });

  it('rejects empty and non-image selections', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
    const file = new File(['x'], 'note.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('rethrows decode failures as a ToolError', async () => {
    setFakeDecoder(() => {
      throw new Error('boom');
    });
    await expect(tool.run({ files: [img('a.png', 5, 5)], options: {} })).rejects.toThrow(
      /could not be decoded/i,
    );
  });

  it('honours an aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({ files: [img('a.png', 5, 5)], options: {}, signal: controller.signal }),
    ).rejects.toThrow(/cancelled/i);
  });
});
