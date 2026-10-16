import { afterEach, describe, expect, it, vi } from 'vitest';
import tool, { hexColor, quantizePixels } from './image-palette.tool';

/** jsdom lacks OffscreenCanvas/createImageBitmap; fake them with fixed pixels. */
function installPixelMocks(pixels: number[], size = { width: 2, height: 2 }) {
  const close = vi.fn();
  class FakeOffscreenCanvas {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    getContext(kind: string) {
      if (kind !== '2d') return null;
      return {
        drawImage() {},
        getImageData() {
          return { data: new Uint8ClampedArray(pixels) };
        },
      };
    }
  }
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: size.width, height: size.height, close })),
  );
  return { close };
}

const img = () => new File([new Uint8Array([1])], 'pic.png', { type: 'image/png' });

afterEach(() => vi.unstubAllGlobals());

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

describe('image-palette run', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects a non-image file', async () => {
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('rejects an unknown algorithm with a friendly error', async () => {
    await expect(tool.run({ files: [img()], options: { algorithm: 'vibes' } })).rejects.toThrow(
      /Unknown palette algorithm/i,
    );
  });

  it('surfaces a friendly error when the browser cannot decode images', async () => {
    await expect(tool.run({ files: [img()], options: {} })).rejects.toThrow(/createImageBitmap/i);
  });

  it('returns a palette report and appearance stats', async () => {
    const { close } = installPixelMocks([
      255, 0, 0, 255, 255, 0, 0, 255, // red ×2 (dark)
      255, 255, 255, 255, // white (light)
      0, 0, 0, 0, // transparent
    ]);
    const result = await tool.run({ files: [img()], options: { colors: 4 } });
    expect(result.report).toMatchObject({ render: 'colors' });
    expect(JSON.parse(result.report!.output)).toEqual(['#ff0000', '#ffffff']);
    expect(result.stats).toMatchObject({
      dominant: '#ff0000',
      appearance: 'mostly dark',
      sampledPixels: 4,
    });
    expect(close).toHaveBeenCalled();
  });

  it('reports a mostly-light image', async () => {
    installPixelMocks([255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
    const result = await tool.run({ files: [img()], options: {} });
    expect(result.stats).toMatchObject({ dominant: '#ffffff', appearance: 'mostly light' });
  });

  it('reports when there are no opaque pixels', async () => {
    installPixelMocks([10, 20, 30, 0, 40, 50, 60, 0]);
    const result = await tool.run({ files: [img()], options: {} });
    expect(result.stats).toMatchObject({ dominant: 'none', appearance: 'no opaque pixels' });
    expect(JSON.parse(result.report!.output)).toEqual([]);
  });

  it('honours the algorithm option and emits progress', async () => {
    installPixelMocks([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255,
    ]);
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

  it('honours an aborted signal', async () => {
    installPixelMocks([255, 0, 0, 255]);
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({ files: [img()], options: {}, signal: controller.signal }),
    ).rejects.toThrow(/cancel/i);
  });
});
