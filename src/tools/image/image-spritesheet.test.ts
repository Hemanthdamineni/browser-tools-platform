import { afterEach, describe, expect, it, vi } from 'vitest';
import tool, { layoutSprites } from './image-spritesheet.tool';
import { installImageMock, makeFile, blobPixels, pixelAt, type MockHandle } from './image-mock';

let mock: MockHandle | undefined;
afterEach(() => {
  mock?.restore();
  mock = undefined;
});

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
  it('normalizes malformed padding and rejects invalid dimensions', () => {
    expect(layoutSprites([{ name: 'a', w: 10, h: 10 }], 'horizontal', 0, Number.NaN)).toMatchObject(
      {
        width: 10,
        height: 10,
      },
    );
    expect(() => layoutSprites([{ name: 'bad', w: Infinity, h: 10 }], 'grid', 0, 0)).toThrow(
      /positive finite dimensions/i,
    );
  });
  it('rejects a sheet that exceeds the per-side canvas limit', () => {
    expect(() => layoutSprites([{ name: 'huge', w: 40_000, h: 1 }], 'grid', 0, 0)).toThrow(
      /too large/i,
    );
  });
  it('rejects a sheet that exceeds the total pixel budget even when both sides fit', () => {
    const items = Array.from({ length: 4 }, (_, i) => ({ name: `s${i}`, w: 8000, h: 8000 }));
    expect(() => layoutSprites(items, 'grid', 2, 0)).toThrow(/too large/i);
  });
});

describe('image-spritesheet run', () => {
  const readRows = (output: string | undefined) => JSON.parse(output ?? '{}').rows as string[][];
  const install = (dimensions: { width: number; height: number }[]) =>
    installImageMock({ dimensions });

  it('builds a grid sheet with a JSON + CSS report', async () => {
    mock = install([
      { width: 10, height: 10 },
      { width: 40, height: 20 },
      { width: 15, height: 30 },
    ]);
    const result = await tool.run({
      files: [makeFile('a.png'), makeFile('b.png'), makeFile('c.png')],
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
    const dims = [
      { width: 10, height: 20 },
      { width: 30, height: 10 },
    ];
    mock = install(dims);
    const horizontal = await tool.run({
      files: [makeFile('a.png'), makeFile('b.png')],
      options: { layout: 'horizontal', padding: 2 },
    });
    expect(horizontal.stats).toMatchObject({ sprites: 2, width: 42, height: 20 });

    mock.restore();
    mock = install(dims);
    const vertical = await tool.run({
      files: [makeFile('a.png'), makeFile('b.png')],
      options: { layout: 'vertical', padding: 2 },
    });
    expect(vertical.stats).toMatchObject({ sprites: 2, width: 30, height: 32 });

    mock.restore();
    mock = install(dims);
    const packed = await tool.run({
      files: [makeFile('a.png'), makeFile('b.png')],
      options: { layout: 'packed', padding: 2 },
    });
    expect(packed.stats).toMatchObject({ sprites: 2, width: 30, height: 32 });
  });

  it('honours the grid columns option', async () => {
    mock = install([
      { width: 10, height: 20 },
      { width: 30, height: 10 },
    ]);
    const result = await tool.run({
      files: [makeFile('a.png'), makeFile('b.png')],
      options: { layout: 'grid', columns: 1, padding: 0 },
    });
    expect(result.stats).toMatchObject({ sprites: 2, width: 30, height: 40 });
  });

  it('decodes every file in a batch and reports progress', async () => {
    mock = install(Array.from({ length: 5 }, (_, i) => ({ width: 8 + i, height: 8 + i })));
    const onProgress = vi.fn();
    const result = await tool.run({
      files: Array.from({ length: 5 }, (_, i) => makeFile(`sprite-${i}.png`)),
      options: { layout: 'horizontal', padding: 1 },
      onProgress,
    });
    expect(result.stats?.sprites).toBe(5);
    expect(onProgress).toHaveBeenCalledWith(1, 'Done');
  });

  it('disambiguates duplicate sprite names', async () => {
    mock = install([
      { width: 5, height: 5 },
      { width: 5, height: 5 },
    ]);
    const result = await tool.run({
      files: [makeFile('a.png'), makeFile('a.jpg', 'image/jpeg')],
      options: { layout: 'horizontal', padding: 1 },
    });
    const rows = readRows(result.report?.output);
    const json = JSON.parse(rows[0]![0]!) as { sprites: { name: string }[] };
    expect(json.sprites.map((sprite) => sprite.name)).toEqual(['a', 'a-1']);
  });

  it('sanitizes sprite names used as CSS classes', async () => {
    mock = install([{ width: 5, height: 5 }]);
    const result = await tool.run({
      files: [makeFile('my icon@2x.png')],
      options: {},
    });
    const rows = readRows(result.report?.output);
    expect(rows[0]![1]).toContain('.sprite-my-icon-2x');
  });

  it('handles a Unicode file name', async () => {
    mock = install([{ width: 5, height: 5 }]);
    const result = await tool.run({ files: [makeFile('图标.png')], options: {} });
    const rows = readRows(result.report?.output);
    expect(rows[0]![1]).toContain('.sprite-图标');
  });

  it('draws each sprite at its computed position, leaving padding transparent', async () => {
    mock = installImageMock({
      dimensions: [
        { width: 2, height: 2 },
        { width: 2, height: 2 },
      ],
      colors: [
        [255, 0, 0, 255],
        [0, 0, 255, 255],
      ],
      pixelOutput: true,
    });
    const result = await tool.run({
      files: [makeFile('a.png'), makeFile('b.png')],
      options: { layout: 'horizontal', padding: 1 },
    });
    // Two 2×2 sprites with a 1px gap produce a 5×2 sheet.
    expect(result.stats).toMatchObject({ sprites: 2, width: 5, height: 2 });
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixelAt(pixels, 5, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(pixels, 5, 2, 0)).toEqual([0, 0, 0, 0]); // padding gap stays transparent
    expect(pixelAt(pixels, 5, 3, 0)).toEqual([0, 0, 255, 255]);
  });

  it('exports WebP when requested', async () => {
    mock = install([{ width: 5, height: 5 }]);
    const result = await tool.run({ files: [makeFile('a.png')], options: { format: 'webp' } });
    expect(result.outputs[0]!.filename).toBe('spritesheet.webp');
    expect(result.outputs[0]!.blob.type).toBe('image/webp');
  });

  it('reports a friendly error when the browser cannot encode WebP', async () => {
    mock = install([{ width: 5, height: 5 }]);
    mock.setBlobType('image/png');
    await expect(
      tool.run({ files: [makeFile('a.png')], options: { format: 'webp' } }),
    ).rejects.toThrow(/cannot encode WEBP images/i);
  });

  it('rejects empty and non-image selections', async () => {
    mock = installImageMock();
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
    const file = new File(['x'], 'note.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('rejects a source image that is too large', async () => {
    mock = install([{ width: 20_000, height: 1 }]);
    await expect(tool.run({ files: [makeFile('huge.png')], options: {} })).rejects.toThrow(
      /too large/i,
    );
  });

  it('rethrows decode failures as a ToolError', async () => {
    mock = installImageMock();
    mock.setDecoder(() => {
      throw new Error('boom');
    });
    await expect(tool.run({ files: [makeFile('a.png')], options: {} })).rejects.toThrow(
      /could not be decoded/i,
    );
  });

  it('honours an aborted signal', async () => {
    mock = installImageMock();
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({ files: [makeFile('a.png')], options: {}, signal: controller.signal }),
    ).rejects.toThrow(/cancelled/i);
  });
});
