import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import tool, { comparePixels } from './image-diff.tool';
import {
  blobPixels,
  imageFile,
  installFakeImageEnv,
  pixelAt,
  resetFakeImageEnv,
  setFakeBlobType,
  setFakeDecoder,
  solidImage,
} from './test-canvas';

describe('comparePixels', () => {
  it('counts thresholded per-pixel RGB differences and summarizes deltas', () => {
    expect(
      comparePixels([0, 0, 0, 255, 10, 20, 30, 255], [30, 20, 10, 0, 12, 20, 30, 255], 5),
    ).toEqual({
      pixels: 2,
      differing: 1,
      percent: 50,
      mean: 16,
      max: 30,
      deltas: [30, 2],
    });
  });
  it('ignores alpha and handles empty pixel arrays', () => {
    expect(comparePixels([1, 2, 3, 0], [1, 2, 3, 255], 0)).toMatchObject({
      differing: 0,
      mean: 0,
      max: 0,
    });
    expect(comparePixels([], [], 10)).toEqual({
      pixels: 0,
      differing: 0,
      percent: 0,
      mean: 0,
      max: 0,
      deltas: [],
    });
  });
});

describe('image-diff run', () => {
  beforeEach(() => installFakeImageEnv());
  afterEach(() => resetFakeImageEnv());

  const red = (name: string, w = 2, h = 2) => imageFile(name, solidImage(w, h, [255, 0, 0, 255]));
  const blue = (name: string, w = 2, h = 2) => imageFile(name, solidImage(w, h, [0, 0, 255, 255]));
  const readTable = (output: string | undefined) => JSON.parse(output ?? '{}');

  it('reports identical images with a heatmap PNG and a stats table', async () => {
    const result = await tool.run({ files: [red('a.png'), red('b.png')], options: {} });
    expect(result.outputs[0]!.filename).toBe('image-diff.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');
    expect(result.report?.render).toBe('table');
    const table = readTable(result.report?.output);
    expect(table.rows).toContainEqual(['Differing pixels', '0']);
    expect(table.rows).toContainEqual(['Identical', 'Yes']);
    expect(result.stats).toMatchObject({ pixels: 4, differing: 0, percent: 0 });
    expect(result.notes).toBeUndefined();
  });

  it('counts differing pixels and marks them in the heatmap', async () => {
    const result = await tool.run({
      files: [red('a.png'), blue('b.png')],
      options: { threshold: 10 },
    });
    expect(result.stats).toMatchObject({ pixels: 4, differing: 4, percent: 100 });
    expect(readTable(result.report?.output).rows).toContainEqual(['Identical', 'No']);
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixelAt(pixels, 2, 0, 0)).toEqual([255, 0, 0, 255]);
  });

  it('honours the difference threshold option', async () => {
    const near = imageFile('near.png', solidImage(2, 2, [255, 10, 0, 255]));
    const far = imageFile('far.png', solidImage(2, 2, [255, 0, 0, 255]));
    const low = await tool.run({ files: [near, far], options: { threshold: 1 } });
    const high = await tool.run({ files: [near, far], options: { threshold: 10 } });
    expect(low.stats?.differing).toBe(4);
    expect(high.stats?.differing).toBe(0);
  });

  it('renders a highlight view that dims unchanged pixels', async () => {
    const same = await tool.run({
      files: [red('a.png'), red('b.png')],
      options: { output: 'highlight' },
    });
    const samePixels = await blobPixels(same.outputs[0]!.blob);
    expect(pixelAt(samePixels, 2, 0, 0)).toEqual([89, 0, 0, 255]);

    const diff = await tool.run({
      files: [red('a.png'), blue('b.png')],
      options: { output: 'highlight' },
    });
    const diffPixels = await blobPixels(diff.outputs[0]!.blob);
    expect(pixelAt(diffPixels, 2, 0, 0)).toEqual([255, 0, 255, 255]);
  });

  it('renders both images side by side', async () => {
    const result = await tool.run({
      files: [red('a.png'), blue('b.png')],
      options: { output: 'side-by-side' },
    });
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixels.length).toBe(4 * 2 * 4);
    expect(pixelAt(pixels, 4, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(pixels, 4, 3, 0)).toEqual([0, 0, 255, 255]);
  });

  it('scales the second image to fit side by side and notes the mismatch', async () => {
    const wide = imageFile('wide.png', solidImage(4, 2, [255, 0, 0, 255]));
    const small = imageFile('small.png', solidImage(2, 2, [0, 0, 255, 255]));
    const result = await tool.run({ files: [wide, small], options: { output: 'side-by-side' } });
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixels.length).toBe(8 * 2 * 4);
    expect(pixelAt(pixels, 8, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(pixels, 8, 6, 0)).toEqual([0, 0, 255, 255]);
    expect(result.notes?.[0]).toMatch(/scaled to the first image dimensions/i);
  });

  it('compares mismatched sizes by scaling and notes it', async () => {
    const wide = imageFile('wide.png', solidImage(4, 2, [255, 0, 0, 255]));
    const flat = imageFile('flat.png', solidImage(2, 1, [255, 0, 0, 255]));
    const result = await tool.run({ files: [wide, flat], options: {} });
    expect(result.stats?.differing).toBe(0);
    expect(result.notes?.[0]).toMatch(/scaled/i);
  });

  it('requires exactly two files', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/exactly two images/i);
    await expect(tool.run({ files: [red('a.png')], options: {} })).rejects.toThrow(
      /exactly two images/i,
    );
    await expect(
      tool.run({ files: [red('a.png'), red('b.png'), red('c.png')], options: {} }),
    ).rejects.toThrow(/exactly two images/i);
  });

  it('rejects non-image files', async () => {
    const file = new File(['x'], 'note.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [file, file], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('rethrows decode failures as a ToolError', async () => {
    setFakeDecoder(() => {
      throw new Error('boom');
    });
    await expect(tool.run({ files: [red('a.png'), red('b.png')], options: {} })).rejects.toThrow(
      /could not be decoded/i,
    );
  });

  it('reports a friendly error when the browser cannot encode PNG', async () => {
    setFakeBlobType('image/jpeg');
    await expect(tool.run({ files: [red('a.png'), red('b.png')], options: {} })).rejects.toThrow(
      /encode a PNG/i,
    );
  });

  it('honours an aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({ files: [red('a.png'), red('b.png')], options: {}, signal: controller.signal }),
    ).rejects.toThrow(/cancelled/i);
  });
});
