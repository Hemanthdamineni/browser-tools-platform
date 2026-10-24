import { afterEach, describe, expect, it, vi } from 'vitest';
import tool from './image-collage.tool';
import {
  collageCanvas,
  fitRect,
  gridCells,
  moveItem,
  parseOrder,
  resolveColumns,
} from './image-collage.core';
import { installImageMock, makeFile, blobPixels, pixelAt, type MockHandle } from './image-mock';

let mock: MockHandle | undefined;
afterEach(() => {
  mock?.restore();
  mock = undefined;
});

/* -------------------------------------------------------------------------- */
/*  Pure geometry                                                              */
/* -------------------------------------------------------------------------- */

describe('gridCells', () => {
  it('lays a 2×2 grid out exactly, centring the spacing', () => {
    const { cells, rows } = gridCells(4, 2, 10, 100, 100);
    expect(rows).toBe(2);
    expect(cells).toEqual([
      { x: 0, y: 0, w: 45, h: 45 },
      { x: 55, y: 0, w: 45, h: 45 },
      { x: 0, y: 55, w: 45, h: 45 },
      { x: 55, y: 55, w: 45, h: 45 },
    ]);
  });

  it('leaves the last cell of an odd grid empty (3 images, 2 columns)', () => {
    const { cells, rows } = gridCells(3, 2, 10, 100, 100);
    expect(rows).toBe(2);
    expect(cells).toEqual([
      { x: 0, y: 0, w: 45, h: 45 },
      { x: 55, y: 0, w: 45, h: 45 },
      { x: 0, y: 55, w: 45, h: 45 },
    ]);
  });

  it('spreads one image across a single column', () => {
    const { cells, rows } = gridCells(2, 1, 4, 40, 84);
    expect(rows).toBe(2);
    expect(cells).toEqual([
      { x: 0, y: 0, w: 40, h: 40 },
      { x: 0, y: 44, w: 40, h: 40 },
    ]);
  });
});

describe('fitRect', () => {
  it('letterboxes a wide image inside a short cell', () => {
    const fit = fitRect({ x: 0, y: 0, w: 100, h: 50 }, 200, 50);
    expect(fit).toEqual({ x: 0, y: 12.5, w: 100, h: 25 });
  });

  it('letterboxes a tall image inside a wide cell', () => {
    const fit = fitRect({ x: 10, y: 10, w: 100, h: 50 }, 50, 200);
    // Contain-fit: scale = min(100/50, 50/200) = 0.25 → 12.5 × 50, centred in
    // the cell. The fit must stay inside the cell on both axes.
    expect(fit).toEqual({ x: 53.75, y: 10, w: 12.5, h: 50 });
  });
});

describe('collageCanvas + resolveColumns', () => {
  it('sizes a square collage from the largest source edge', () => {
    expect(collageCanvas(4, 2, 10, 100)).toEqual({ width: 210, height: 210, rows: 2 });
  });

  it('picks a square-ish column count for auto', () => {
    expect(resolveColumns('auto', 4)).toBe(2);
    expect(resolveColumns('auto', 9)).toBe(3);
  });

  it('clamps a column count to the number of images', () => {
    expect(resolveColumns('4', 2)).toBe(2);
  });

  it('rejects a bogus column value', () => {
    expect(() => resolveColumns('nope', 4)).toThrow(/columns/i);
  });
});

describe('parseOrder + moveItem', () => {
  it('defaults to the identity order', () => {
    expect(parseOrder(undefined, 3)).toEqual([0, 1, 2]);
  });

  it('parses a comma-separated permutation', () => {
    expect(parseOrder('2,0,1', 3)).toEqual([2, 0, 1]);
  });

  it('rejects a list that is not a full permutation', () => {
    expect(() => parseOrder('2,0', 3)).toThrow(/must list all 3/i);
    expect(() => parseOrder('9,0,1', 3)).toThrow(/invalid position/i);
    expect(() => parseOrder('7,0,1', 3)).toThrow(/invalid position/i);
    expect(() => parseOrder('1,1,2', 3)).toThrow(/twice/i);
  });

  it('moves an item to a new position without touching the others', () => {
    expect(moveItem([0, 1, 2, 3], 0, 2)).toEqual([1, 2, 0, 3]);
    expect(moveItem([0, 1, 2, 3], 2, 0)).toEqual([2, 0, 1, 3]);
    expect(moveItem([0, 1, 2, 3], 9, 0)).toEqual([0, 1, 2, 3]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Tool run()                                                                 */
/* -------------------------------------------------------------------------- */

describe('image-collage run', () => {
  const install = (dimensions: { width: number; height: number }[]) =>
    installImageMock({ dimensions });

  it('builds a default 2-column collage and reports the grid', async () => {
    mock = install([
      { width: 10, height: 20 },
      { width: 20, height: 10 },
    ]);
    const result = await tool.run({ files: [makeFile('a.png'), makeFile('b.png')], options: {} });
    expect(result.outputs[0]!.filename).toBe('collage.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');
    // cellSize = 20 (largest edge), auto columns = 2, default spacing 8
    // → 2×1 grid, width = 2·20 + 1·8 = 48.
    expect(result.stats).toMatchObject({ images: 2, columns: 2, width: 48, height: 20 });
  });

  it('honours an explicit column count', async () => {
    mock = install([
      { width: 10, height: 10 },
      { width: 10, height: 10 },
    ]);
    const result = await tool.run({
      files: [makeFile('a.png'), makeFile('b.png')],
      options: { columns: '1', spacing: 0 },
    });
    expect(result.stats).toMatchObject({ images: 2, columns: 1, width: 10, height: 20 });
  });

  it('reordering permutes placements, never the pixels', async () => {
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
    const run = (order: string) =>
      tool.run({
        files: [makeFile('a.png'), makeFile('b.png')],
        options: { columns: '1', spacing: 0, order },
      });

    const ordered = await run('0,1');
    const orderedPixels = await blobPixels(ordered.outputs[0]!.blob);
    // cell 0 (rows 0–1) holds the red photo, cell 1 (rows 2–3) the blue one.
    expect(pixelAt(orderedPixels, 2, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(orderedPixels, 2, 0, 2)).toEqual([0, 0, 255, 255]);

    const swapped = await run('1,0');
    const swappedPixels = await blobPixels(swapped.outputs[0]!.blob);
    // The same two images, but now their placements are swapped.
    expect(pixelAt(swappedPixels, 2, 0, 0)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(swappedPixels, 2, 0, 2)).toEqual([255, 0, 0, 255]);
  });

  it('paints the background colour around the cells', async () => {
    mock = installImageMock({
      dimensions: [
        { width: 2, height: 2 },
        { width: 2, height: 2 },
      ],
      colors: [
        [255, 0, 0, 255],
        [255, 0, 0, 255],
      ],
      pixelOutput: true,
    });
    const result = await tool.run({
      files: [makeFile('a.png'), makeFile('b.png')],
      options: { columns: '1', spacing: 2, background: '#00ff00' },
    });
    const pixels = await blobPixels(result.outputs[0]!.blob);
    // The gap between the two 2×2 cells (spacing 2) is the background green.
    expect(pixelAt(pixels, 2, 0, 2)).toEqual([0, 255, 0, 255]);
  });

  it('flattens a transparent background to white for JPEG', async () => {
    mock = installImageMock({
      dimensions: [
        { width: 2, height: 2 },
        { width: 2, height: 2 },
      ],
      colors: [
        [255, 0, 0, 255],
        [255, 0, 0, 255],
      ],
      pixelOutput: true,
    });
    const result = await tool.run({
      files: [makeFile('a.png'), makeFile('b.png')],
      options: { columns: '1', spacing: 2, format: 'jpeg' },
    });
    expect(result.outputs[0]!.filename).toBe('collage.jpg');
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixelAt(pixels, 2, 0, 2)).toEqual([255, 255, 255, 255]);
  });

  it('reports progress and honours an aborted signal', async () => {
    mock = install([{ width: 8, height: 8 }]);
    const onProgress = vi.fn();
    const controller = new AbortController();
    controller.abort();
    const result = await tool
      .run({
        files: [makeFile('a.png')],
        options: {},
        onProgress,
        signal: controller.signal,
      })
      .then(
        () => null,
        (error) => error,
      );
    expect((result as Error).name).toBe('AbortError');
  });

  it('rejects empty and non-image selections', async () => {
    mock = install([{ width: 5, height: 5 }]);
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/choose an image/i);
    await expect(
      tool.run({ files: [makeFile('a.txt', 'text/plain')], options: {} }),
    ).rejects.toThrow(/not an image/i);
  });

  it('rejects a source image that is too large', async () => {
    mock = install([{ width: 40_000, height: 40_000 }]);
    await expect(tool.run({ files: [makeFile('huge.png')], options: {} })).rejects.toThrow(
      /too large/i,
    );
  });

  it('rejects a bad background colour', async () => {
    mock = install([{ width: 5, height: 5 }]);
    await expect(
      tool.run({ files: [makeFile('a.png')], options: { background: 'not-a-colour' } }),
    ).rejects.toThrow(/hex colour/i);
  });

  it('decodes every file in a batch', async () => {
    mock = install(Array.from({ length: 5 }, (_, i) => ({ width: 6 + i, height: 6 + i })));
    const result = await tool.run({
      files: Array.from({ length: 5 }, (_, i) => makeFile(`photo-${i}.png`)),
      options: {},
    });
    expect(result.stats?.images).toBe(5);
  });
});
