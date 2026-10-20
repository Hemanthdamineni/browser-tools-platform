import { afterEach, describe, expect, it, vi } from 'vitest';
import tool, { comparePixels, pixelDelta } from './image-diff.tool';
import { blobPixels, installImageMock, makeFile, pixelAt, type MockHandle } from './image-mock';

let mock: MockHandle | undefined;
afterEach(() => {
  mock?.restore();
  mock = undefined;
});

const RED = [255, 0, 0, 255] as [number, number, number, number];
const BLUE = [0, 0, 255, 255] as [number, number, number, number];

describe('pixelDelta', () => {
  it('returns the largest RGBA channel difference', () => {
    expect(pixelDelta([0, 10, 0, 255], [0, 20, 0, 255], 0)).toBe(10);
    expect(pixelDelta([0, 0, 0, 0], [0, 0, 0, 255], 0)).toBe(255);
  });
});

describe('comparePixels', () => {
  it('counts thresholded per-pixel RGBA differences and summarizes deltas', () => {
    expect(
      comparePixels([0, 0, 0, 255, 10, 20, 30, 255], [30, 20, 10, 255, 12, 20, 30, 255], 5),
    ).toEqual({
      pixels: 2,
      differing: 1,
      percent: 50,
      mean: 16,
      max: 30,
    });
  });
  it('treats a transparency change as a difference', () => {
    expect(comparePixels([1, 2, 3, 0], [1, 2, 3, 255], 0)).toMatchObject({
      differing: 1,
      max: 255,
    });
    expect(comparePixels([1, 2, 3, 0], [1, 2, 3, 0], 0)).toMatchObject({ differing: 0 });
  });
  it('clamps the threshold and handles empty pixel arrays', () => {
    expect(comparePixels([0, 0, 0, 0], [255, 255, 255, 255], 200)).toMatchObject({ differing: 0 });
    expect(comparePixels([0, 0, 0, 0], [255, 255, 255, 255], -5)).toMatchObject({ differing: 1 });
    expect(comparePixels([], [], 10)).toEqual({
      pixels: 0,
      differing: 0,
      percent: 0,
      mean: 0,
      max: 0,
    });
  });
});

describe('image-diff run', () => {
  const readTable = (output: string | undefined) => JSON.parse(output ?? '{}');

  const install = (
    dimensions: { width: number; height: number }[],
    colors: [number, number, number, number][],
  ) => installImageMock({ dimensions, colors, pixelOutput: true });

  it('reports identical images with a heatmap PNG and a stats table', async () => {
    mock = install(
      [
        { width: 2, height: 2 },
        { width: 2, height: 2 },
      ],
      [RED, RED],
    );
    const result = await tool.run({ files: [makeFile('a.png'), makeFile('b.png')], options: {} });
    expect(result.outputs[0]!.filename).toBe('image-diff.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');
    expect(result.report?.render).toBe('table');
    const table = readTable(result.report?.output);
    expect(table.rows).toContainEqual(['Differing pixels', '0']);
    expect(table.rows).toContainEqual(['Identical', 'Yes']);
    expect(table.rows).toContainEqual(['Total pixels', '4']);
    expect(result.stats).toMatchObject({ pixels: 4, differing: 0, percent: 0 });
    expect(result.notes?.some((note) => /RGBA/.test(note))).toBe(true);
  });

  it('counts differing pixels and marks them in the heatmap', async () => {
    mock = install(
      [
        { width: 2, height: 2 },
        { width: 2, height: 2 },
      ],
      [RED, BLUE],
    );
    const result = await tool.run({
      files: [makeFile('a.png'), makeFile('b.png')],
      options: { threshold: 10 },
    });
    expect(result.stats).toMatchObject({ pixels: 4, differing: 4, percent: 100 });
    expect(readTable(result.report?.output).rows).toContainEqual(['Identical', 'No']);
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixelAt(pixels, 2, 0, 0)).toEqual([255, 0, 0, 255]);
  });

  it('honours the difference threshold option', async () => {
    mock = install(
      [
        { width: 2, height: 2 },
        { width: 2, height: 2 },
      ],
      [
        [255, 10, 0, 255],
        [255, 0, 0, 255],
      ],
    );
    const files = [makeFile('near.png'), makeFile('far.png')];
    const low = await tool.run({ files, options: { threshold: 1 } });
    const high = await tool.run({ files, options: { threshold: 10 } });
    expect(low.stats?.differing).toBe(4);
    expect(high.stats?.differing).toBe(0);
  });

  it('renders a highlight view that dims unchanged pixels', async () => {
    mock = install(
      [
        { width: 2, height: 2 },
        { width: 2, height: 2 },
      ],
      [RED, RED],
    );
    const same = await tool.run({
      files: [makeFile('a.png'), makeFile('b.png')],
      options: { output: 'highlight' },
    });
    const samePixels = await blobPixels(same.outputs[0]!.blob);
    expect(pixelAt(samePixels, 2, 0, 0)).toEqual([89, 0, 0, 255]);

    mock.restore();
    mock = install(
      [
        { width: 2, height: 2 },
        { width: 2, height: 2 },
      ],
      [RED, BLUE],
    );
    const diff = await tool.run({
      files: [makeFile('a.png'), makeFile('b.png')],
      options: { output: 'highlight' },
    });
    const diffPixels = await blobPixels(diff.outputs[0]!.blob);
    expect(pixelAt(diffPixels, 2, 0, 0)).toEqual([255, 0, 255, 255]);
  });

  it('renders both images side by side', async () => {
    mock = install(
      [
        { width: 2, height: 2 },
        { width: 2, height: 2 },
      ],
      [RED, BLUE],
    );
    const result = await tool.run({
      files: [makeFile('a.png'), makeFile('b.png')],
      options: { output: 'side-by-side' },
    });
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixels.length).toBe(4 * 2 * 4);
    expect(pixelAt(pixels, 4, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(pixels, 4, 3, 0)).toEqual([0, 0, 255, 255]);
  });

  it('scales the second image to fit side by side and notes the mismatch', async () => {
    mock = install(
      [
        { width: 4, height: 2 },
        { width: 2, height: 2 },
      ],
      [RED, BLUE],
    );
    const result = await tool.run({
      files: [makeFile('wide.png'), makeFile('small.png')],
      options: { output: 'side-by-side' },
    });
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixels.length).toBe(8 * 2 * 4);
    expect(pixelAt(pixels, 8, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(pixels, 8, 6, 0)).toEqual([0, 0, 255, 255]);
    expect(result.notes?.[0]).toMatch(/scaled to the first image dimensions/i);
  });

  it('compares mismatched sizes by scaling and notes it', async () => {
    mock = install(
      [
        { width: 4, height: 2 },
        { width: 2, height: 1 },
      ],
      [RED, RED],
    );
    const result = await tool.run({
      files: [makeFile('wide.png'), makeFile('flat.png')],
      options: {},
    });
    expect(result.stats?.differing).toBe(0);
    expect(result.notes?.[0]).toMatch(/scaled/i);
  });

  it('requires exactly two files', async () => {
    mock = installImageMock({ pixelOutput: true });
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/exactly two images/i);
    await expect(tool.run({ files: [makeFile('a.png')], options: {} })).rejects.toThrow(
      /exactly two images/i,
    );
    await expect(
      tool.run({ files: [makeFile('a.png'), makeFile('b.png'), makeFile('c.png')], options: {} }),
    ).rejects.toThrow(/exactly two images/i);
  });

  it('rejects non-image files', async () => {
    const file = new File(['x'], 'note.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [file, file], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('rethrows decode failures as a ToolError', async () => {
    mock = installImageMock();
    mock.setDecoder(() => {
      throw new Error('boom');
    });
    await expect(
      tool.run({ files: [makeFile('a.png'), makeFile('b.png')], options: {} }),
    ).rejects.toThrow(/could not be decoded/i);
  });

  it('rejects images that are too large to process safely', async () => {
    mock = installImageMock({
      dimensions: [
        { width: 20_000, height: 20_000 },
        { width: 20_000, height: 20_000 },
      ],
    });
    await expect(
      tool.run({ files: [makeFile('a.png'), makeFile('b.png')], options: {} }),
    ).rejects.toThrow(/too large/i);
  });

  it('reports a friendly error when the browser cannot encode PNG', async () => {
    mock = install(
      [
        { width: 2, height: 2 },
        { width: 2, height: 2 },
      ],
      [RED, BLUE],
    );
    mock.setBlobType('image/jpeg');
    await expect(
      tool.run({ files: [makeFile('a.png'), makeFile('b.png')], options: {} }),
    ).rejects.toThrow(/cannot encode PNG/i);
  });

  it('honours an aborted signal', async () => {
    mock = installImageMock();
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({
        files: [makeFile('a.png'), makeFile('b.png')],
        options: {},
        signal: controller.signal,
      }),
    ).rejects.toThrow(/cancelled/i);
  });

  it('reports progress while comparing', async () => {
    mock = install(
      [
        { width: 2, height: 2 },
        { width: 2, height: 2 },
      ],
      [RED, BLUE],
    );
    const onProgress = vi.fn();
    await tool.run({ files: [makeFile('a.png'), makeFile('b.png')], options: {}, onProgress });
    expect(onProgress).toHaveBeenCalledWith(1, 'Done');
    expect(onProgress).toHaveBeenCalledWith(0, 'Decoding images');
  });
});
