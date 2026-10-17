import { afterEach, describe, expect, it, vi } from 'vitest';
import tool, { hexColor, quantizePixels } from './image-palette.tool';
import { installImageMock, makeFile, type MockHandle } from './image-mock';

let mock: MockHandle | undefined;
afterEach(() => {
  mock?.restore();
  mock = undefined;
});

const img = (name = 'pic.png') => makeFile(name, 'image/png');

describe('hexColor', () => {
  it('formats and rounds to lowercase #rrggbb', () => {
    expect(hexColor({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
    expect(hexColor({ r: 255.4, g: 16.7, b: 0 })).toBe('#ff1100');
  });
  it('clamps out-of-range channels', () => {
    expect(hexColor({ r: 300, g: -5, b: 128 })).toBe('#ff0080');
  });
});

describe('quantizePixels', () => {
  it('clamps and caps the requested colour count', () => {
    expect(quantizePixels([255, 0, 0, 255], 1)).toEqual(['#ff0000']);
    const white = quantizePixels([255, 255, 255, 255], 3);
    expect(white.length).toBeLessThanOrEqual(3);
    expect(white[0]).toBe('#ffffff');
  });

  it('falls back to six colours for a non-finite count and caps at sixteen', () => {
    const distinct = [
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255, 255, 0, 255, 255, 0, 255,
      255, 255, 128, 128, 128, 255, 64, 192, 32, 255,
    ];
    expect(quantizePixels(distinct, Number.NaN)).toHaveLength(6);
    expect(quantizePixels(distinct, 100).length).toBeLessThanOrEqual(16);
  });

  it('most-frequent keeps the most common buckets, ordered by count', () => {
    const pixels = [
      255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, // red ×3
      0, 255, 0, 255, 0, 255, 0, 255, // green ×2
      0, 0, 255, 255, // blue ×1
    ];
    const palette = quantizePixels(pixels, 2, 'most-frequent');
    expect(palette).toEqual(['#ff0000', '#00ff00']);
  });

  it('median-cut spreads representatives across a gradient', () => {
    const gray = [0, 0, 0, 255, 85, 85, 85, 255, 170, 170, 170, 255, 255, 255, 255, 255];
    const palette = quantizePixels(gray, 4, 'median-cut');
    expect(palette).toHaveLength(4);
    expect(palette).toContain('#000000');
    expect(palette).toContain('#ffffff');
  });

  it('k-means separates two colour clusters and is deterministic', () => {
    const pixels = [
      255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, // red ×4
      0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, // blue ×4
      40, 0, 255, 255, // outlier close to blue
    ];
    const a = quantizePixels(pixels, 2, 'k-means');
    const b = quantizePixels(pixels, 2, 'k-means');
    expect(a).toEqual(b);
    expect(a).toHaveLength(2);
    expect(a).toContain('#ff0000'); // pure red cluster
    expect(a.some((color) => color.endsWith('ff'))).toBe(true); // blue-ish cluster
  });

  it('ignores near-transparent pixels but keeps alpha ≥ 32', () => {
    expect(quantizePixels([10, 20, 30, 0], 4)).toEqual([]);
    expect(quantizePixels([255, 0, 0, 31], 4)).toEqual([]);
    expect(quantizePixels([255, 0, 0, 32], 4)).toEqual(['#ff0000']);
  });

  it('buckets and clamps high channel values to 255', () => {
    expect(quantizePixels([250, 250, 250, 255], 2)).toEqual(['#ffffff']);
  });

  it('returns an empty palette when there are no complete pixels', () => {
    expect(quantizePixels([], 4)).toEqual([]);
    expect(quantizePixels([1, 2, 3], 4)).toEqual([]);
  });

  it('falls back to median-cut for an unknown algorithm', () => {
    const pixels = [255, 0, 0, 255, 0, 0, 255, 255, 12, 34, 56, 255];
    expect(quantizePixels(pixels, 2, 'nope')).toEqual(quantizePixels(pixels, 2, 'median-cut'));
  });
});

interface Table {
  headers: string[];
  rows: string[][];
}

describe('image-palette run', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects a non-image file', async () => {
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('rejects an unknown algorithm with a friendly error before decoding', async () => {
    await expect(tool.run({ files: [img()], options: { algorithm: 'vibes' } })).rejects.toThrow(
      /Unknown palette algorithm/i,
    );
  });

  it('surfaces a friendly error when the browser cannot decode images', async () => {
    await expect(tool.run({ files: [img()], options: {} })).rejects.toThrow(/createImageBitmap/i);
  });

  it('reports a friendly error for undecodable bytes', async () => {
    mock = installImageMock({ failDecode: true });
    await expect(tool.run({ files: [img()], options: {} })).rejects.toThrow(/could not be decoded/i);
  });

  it('returns a palette report and appearance stats, ignoring transparency', async () => {
    mock = installImageMock({
      width: 2,
      height: 2,
      pixels: [
        255, 0, 0, 255, 255, 0, 0, 255, // red ×2 (dark)
        255, 255, 255, 255, // white (light)
        0, 0, 0, 0, // transparent
      ],
    });
    const result = await tool.run({ files: [img()], options: { colors: 4 } });
    expect(result.report).toMatchObject({ render: 'colors' });
    expect(JSON.parse(result.report!.output)).toEqual(['#ff0000', '#ffffff']);
    expect(result.stats).toMatchObject({
      dominant: '#ff0000',
      appearance: 'mostly dark',
      sampledPixels: 4,
    });
    expect(mock.bitmaps[0]!.closed).toBe(true);
  });

  it('reports a mostly-light image', async () => {
    mock = installImageMock({
      width: 2,
      height: 2,
      pixels: [
        255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
      ],
    });
    const result = await tool.run({ files: [img()], options: {} });
    expect(result.stats).toMatchObject({ dominant: '#ffffff', appearance: 'mostly light' });
  });

  it('reports when there are no opaque pixels', async () => {
    mock = installImageMock({ width: 2, height: 1, pixels: [10, 20, 30, 0, 40, 50, 60, 0] });
    const result = await tool.run({ files: [img()], options: {} });
    expect(result.stats).toMatchObject({ dominant: 'none', appearance: 'no opaque pixels' });
    expect(JSON.parse(result.report!.output)).toEqual([]);
  });

  it('honours the algorithm option and emits progress', async () => {
    mock = installImageMock({
      width: 2,
      height: 2,
      pixels: [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255],
    });
    const progress: number[] = [];
    const result = await tool.run({
      files: [img()],
      options: { algorithm: 'most-frequent', colors: 2 },
      onProgress: (fraction) => progress.push(fraction),
    });
    expect(JSON.parse(result.report!.output)).toHaveLength(2);
    expect(progress.at(0)).toBe(0);
    expect(progress.at(-1)).toBe(1);
  });

  it('clamps a below-range colour count to one', async () => {
    mock = installImageMock({ width: 1, height: 1, pixels: [255, 0, 0, 255] });
    const result = await tool.run({ files: [img()], options: { colors: 1 } });
    expect(JSON.parse(result.report!.output)).toEqual(['#ff0000']);
  });

  it('requests EXIF orientation while decoding', async () => {
    mock = installImageMock({ width: 1, height: 1, pixels: [255, 0, 0, 255] });
    await tool.run({ files: [img('photo.jpg')], options: {} });
    expect(mock.bitmaps[0]!.options).toEqual({ imageOrientation: 'from-image' });
  });

  it('compares several images in one table, labelled by filename', async () => {
    mock = installImageMock({ width: 2, height: 1, pixels: [255, 0, 0, 255, 0, 0, 255, 255] });
    const onProgress = vi.fn();
    const result = await tool.run({
      files: [img('фото.png'), img('日本語.png')],
      options: { colors: 2 },
      onProgress,
    });

    expect(result.report).toMatchObject({ render: 'table' });
    const table = JSON.parse(result.report!.output) as Table;
    expect(table.headers).toEqual(['File', 'Dominant', 'Palette']);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]![0]).toBe('фото.png');
    expect(table.rows[1]![0]).toBe('日本語.png');
    expect(table.rows[0]![1]).toMatch(/^#[0-9a-f]{6}$/);
    expect(table.rows[0]![2]).toContain(', ');
    expect(result.stats).toMatchObject({ files: 2 });
    expect(onProgress).toHaveBeenCalledWith(1, 'Done');
  });

  it('rejects an oversized image with a friendly error instead of crashing', async () => {
    mock = installImageMock({ width: 20_000, height: 20_000 });
    await expect(tool.run({ files: [img('huge.png')], options: {} })).rejects.toThrow(/too large/i);
  });

  it('honours an aborted signal', async () => {
    mock = installImageMock({ width: 1, height: 1, pixels: [255, 0, 0, 255] });
    await expect(
      tool.run({ files: [img()], options: {}, signal: AbortSignal.abort() }),
    ).rejects.toThrow(/cancel/i);
  });
});
