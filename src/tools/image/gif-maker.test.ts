import { afterEach, describe, it, expect, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import tool, {
  resolveGifOptions,
  computeTargetSize,
  quantizePalette,
  applyPaletteIndices,
  ditherToIndices,
  colorDepthForPalette,
  toGifPalette,
  encodeFramesToGif,
} from './gif-maker.tool';
import { installImageMock, makeFile, type MockHandle } from './image-mock';

let mock: MockHandle | undefined;
afterEach(() => {
  mock?.restore();
  mock = undefined;
});

const PNG = (name = 'frame.png', size = 200) => makeFile(name, 'image/png', size);

describe('gif-maker resolveGifOptions', () => {
  it('uses defaults for empty options', () => {
    const opts = resolveGifOptions({});
    expect(opts).toEqual({
      delayMs: 100,
      loopCount: 0,
      targetWidth: 0,
      targetHeight: 0,
      maxColors: 256,
      dither: true,
    });
  });

  it('respects min bounds but has no max limits', () => {
    expect(resolveGifOptions({ delay: 5 }).delayMs).toBe(10);
    expect(resolveGifOptions({ delay: 20000 }).delayMs).toBe(20000);
    expect(resolveGifOptions({ delay: 250 }).delayMs).toBe(250);
  });

  it('respects min bounds but has no max limits', () => {
    expect(resolveGifOptions({ loop: -1 }).loopCount).toBe(0);
    expect(resolveGifOptions({ loop: 70000 }).loopCount).toBe(70000);
    expect(resolveGifOptions({ loop: 3 }).loopCount).toBe(3);
  });

  it('respects min bounds but has no max limits', () => {
    expect(resolveGifOptions({ width: -100 }).targetWidth).toBe(0);
    expect(resolveGifOptions({ width: 3000 }).targetWidth).toBe(3000);
    expect(resolveGifOptions({ height: 500 }).targetHeight).toBe(500);
  });

  it('respects min bounds but has no max limits', () => {
    expect(resolveGifOptions({ colors: 1 }).maxColors).toBe(2);
    expect(resolveGifOptions({ colors: 300 }).maxColors).toBe(300);
    expect(resolveGifOptions({ colors: 64 }).maxColors).toBe(64);
  });

  it('parses dither boolean', () => {
    expect(resolveGifOptions({ dither: false }).dither).toBe(false);
    expect(resolveGifOptions({ dither: 'true' }).dither).toBe(true);
    expect(resolveGifOptions({ dither: 0 }).dither).toBe(false);
  });
});

describe('computeTargetSize', () => {
  it('returns source size when both targets are 0', () => {
    expect(computeTargetSize(100, 50, 0, 0)).toEqual({ width: 100, height: 50 });
  });

  it('uses both when both specified', () => {
    expect(computeTargetSize(100, 50, 200, 100)).toEqual({ width: 200, height: 100 });
  });

  it('scales from width preserving aspect', () => {
    expect(computeTargetSize(100, 50, 200, 0)).toEqual({ width: 200, height: 100 });
  });

  it('scales from height preserving aspect', () => {
    expect(computeTargetSize(100, 50, 0, 100)).toEqual({ width: 200, height: 100 });
  });

  it('handles non-square aspect ratios', () => {
    expect(computeTargetSize(400, 300, 200, 0)).toEqual({ width: 200, height: 150 });
    expect(computeTargetSize(300, 400, 0, 200)).toEqual({ width: 150, height: 200 });
  });
});

describe('quantizePalette', () => {
  it('returns a palette with at most maxColors entries', () => {
    const rgba = new Uint8ClampedArray(4 * 10);
    for (let i = 0; i < 10; i++) {
      rgba[i * 4] = i * 25;
      rgba[i * 4 + 1] = 128;
      rgba[i * 4 + 2] = 64;
      rgba[i * 4 + 3] = 255;
    }
    const palette = quantizePalette(rgba, 4);
    expect(palette.length).toBeLessThanOrEqual(4);
    expect(palette.length).toBeGreaterThan(0);
  });

  it('handles single color image', () => {
    // Use values that map perfectly through 5-bit quantization: multiples of 255/31 ≈ 8.2258
    // 8 * 8.2258 ≈ 65.8, 16 * 8.2258 ≈ 131.6, 24 * 8.2258 ≈ 197.4
    // Use 64, 128, 192 which are close to 5-bit boundaries
    const rgba = new Uint8ClampedArray(100 * 4);
    for (let i = 0; i < 100; i++) {
      rgba[i * 4] = 64;   // ~8 * 8 = 64 (5-bit 8)
      rgba[i * 4 + 1] = 128; // ~16 * 8 = 128 (5-bit 16)
      rgba[i * 4 + 2] = 192; // ~24 * 8 = 192 (5-bit 24)
      rgba[i * 4 + 3] = 255;
    }
    const palette = quantizePalette(rgba, 256);
    expect(palette.length).toBe(1);
    // Allow small rounding differences from 5-bit quantization
    expect(palette[0].r).toBeGreaterThanOrEqual(60);
    expect(palette[0].r).toBeLessThanOrEqual(70);
    expect(palette[0].g).toBeGreaterThanOrEqual(120);
    expect(palette[0].g).toBeLessThanOrEqual(135);
    expect(palette[0].b).toBeGreaterThanOrEqual(185);
    expect(palette[0].b).toBeLessThanOrEqual(200);
  });

  it('handles empty image', () => {
    const rgba = new Uint8ClampedArray(0);
    const palette = quantizePalette(rgba, 256);
    expect(palette.length).toBe(1);
    expect(palette[0]).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('applyPaletteIndices', () => {
  it('maps pixels to nearest palette index', () => {
    const palette = [
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
      { r: 128, g: 128, b: 128 },
    ];
    const rgba = new Uint8ClampedArray([
      0, 0, 0, 255,
      255, 255, 255, 255,
      128, 128, 128, 255,
      10, 10, 10, 255,
      245, 245, 245, 255,
    ]);
    const indices = applyPaletteIndices(rgba, palette);
    expect(indices[0]).toBe(0); // black
    expect(indices[1]).toBe(1); // white
    expect(indices[2]).toBe(2); // gray
    expect(indices[3]).toBe(0); // near black
    expect(indices[4]).toBe(1); // near white
  });
});

describe('ditherToIndices', () => {
  it('produces same number of indices as pixels', () => {
    const palette = [
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    ];
    const rgba = new Uint8ClampedArray(4 * 16);
    for (let i = 0; i < 16; i++) {
      rgba[i * 4] = 128;
      rgba[i * 4 + 1] = 128;
      rgba[i * 4 + 2] = 128;
      rgba[i * 4 + 3] = 255;
    }
    const indices = ditherToIndices(rgba, 4, 4, palette);
    expect(indices.length).toBe(16);
    expect(indices.every((idx) => idx === 0 || idx === 1)).toBe(true);
  });
});

describe('colorDepthForPalette', () => {
  it('returns correct bit depth for palette sizes', () => {
    expect(colorDepthForPalette([{ r: 0, g: 0, b: 0 }])).toBe(2);
    expect(colorDepthForPalette(Array(2).fill({ r: 0, g: 0, b: 0 }))).toBe(2);
    expect(colorDepthForPalette(Array(3).fill({ r: 0, g: 0, b: 0 }))).toBe(2);
    expect(colorDepthForPalette(Array(4).fill({ r: 0, g: 0, b: 0 }))).toBe(2);
    expect(colorDepthForPalette(Array(16).fill({ r: 0, g: 0, b: 0 }))).toBe(4);
    expect(colorDepthForPalette(Array(256).fill({ r: 0, g: 0, b: 0 }))).toBe(8);
  });
});

describe('toGifPalette', () => {
  it('converts palette to number[][] format', () => {
    const palette = [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
    ];
    const result = toGifPalette(palette);
    expect(result).toEqual([[255, 0, 0], [0, 255, 0]]);
  });
});

describe('gif-maker run', () => {
  it('rejects when no files provided', async () => {
    mock = installImageMock();
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects non-image files', async () => {
    mock = installImageMock();
    const badFile = new File(['not an image'], 'test.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [badFile], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('rejects too many frames', async () => {
    mock = installImageMock({
      dimensions: [{ width: 100, height: 100 }],
      pixels: new Uint8ClampedArray(100 * 100 * 4),
    });
    const files = Array.from({ length: 301 }, (_, i) => PNG(`frame${i}.png`));
    await expect(tool.run({ files, options: {} })).rejects.toThrow(/Too many frames/i);
  });

  it('processes single frame', async () => {
    const pixels = new Uint8ClampedArray(100 * 100 * 4);
    for (let i = 0; i < 100 * 100; i++) {
      pixels[i * 4] = 200;
      pixels[i * 4 + 1] = 100;
      pixels[i * 4 + 2] = 50;
      pixels[i * 4 + 3] = 255;
    }
    mock = installImageMock({
      dimensions: [{ width: 100, height: 100 }],
      pixels,
    });
    const result = await tool.run({ files: [PNG('frame.png')], options: { delay: 100, loop: 0 } });
    expect(result.outputs.length).toBe(1);
    expect(result.outputs[0].filename).toBe('animation.gif');
    expect(result.outputs[0].blob.type).toBe('image/gif');
    expect(result.outputs[0].previewUrl).toContain('data:image/gif;base64,');
    expect(result.stats.frames).toBe(1);
    expect(result.stats.width).toBe(100);
    expect(result.stats.height).toBe(100);
    expect(result.stats.delayMs).toBe(100);
    expect(result.stats.loopCount).toBe(0);
  });

  it('processes multiple frames with custom delay and loop', async () => {
    const pixels = new Uint8ClampedArray(30 * 30 * 4);
    for (let i = 0; i < 30 * 30; i++) {
      pixels[i * 4] = 100;
      pixels[i * 4 + 1] = 150;
      pixels[i * 4 + 2] = 200;
      pixels[i * 4 + 3] = 255;
    }
    mock = installImageMock({
      dimensions: [
        { width: 30, height: 30 },
        { width: 30, height: 30 },
        { width: 30, height: 30 },
      ],
      pixels,
    });
    const result = await tool.run({
      files: [PNG('f1.png'), PNG('f2.png'), PNG('f3.png')],
      options: { delay: 200, loop: 5 },
    });
    expect(result.stats.frames).toBe(3);
    expect(result.stats.delayMs).toBe(200);
    expect(result.stats.loopCount).toBe(5);
  });

  it('resizes frames to target dimensions', async () => {
    const pixels = new Uint8ClampedArray(100 * 100 * 4);
    for (let i = 0; i < 100 * 100; i++) {
      pixels[i * 4] = 50;
      pixels[i * 4 + 1] = 100;
      pixels[i * 4 + 2] = 150;
      pixels[i * 4 + 3] = 255;
    }
    mock = installImageMock({
      dimensions: [{ width: 100, height: 100 }],
      pixels,
    });
    const result = await tool.run({
      files: [PNG('large.png')],
      options: { width: 50, height: 50 },
    });
    expect(result.stats.width).toBe(50);
    expect(result.stats.height).toBe(50);
  });

  it('preserves aspect ratio when only width specified', async () => {
    const pixels = new Uint8ClampedArray(200 * 100 * 4);
    for (let i = 0; i < 200 * 100; i++) {
      pixels[i * 4] = 80;
      pixels[i * 4 + 1] = 80;
      pixels[i * 4 + 2] = 80;
      pixels[i * 4 + 3] = 255;
    }
    mock = installImageMock({
      dimensions: [{ width: 200, height: 100 }],
      pixels,
    });
    const result = await tool.run({
      files: [PNG('wide.png')],
      options: { width: 100 },
    });
    expect(result.stats.width).toBe(100);
    expect(result.stats.height).toBe(50); // 2:1 aspect preserved
  });

  it('preserves aspect ratio when only height specified', async () => {
    const pixels = new Uint8ClampedArray(100 * 200 * 4);
    for (let i = 0; i < 100 * 200; i++) {
      pixels[i * 4] = 80;
      pixels[i * 4 + 1] = 80;
      pixels[i * 4 + 2] = 80;
      pixels[i * 4 + 3] = 255;
    }
    mock = installImageMock({
      dimensions: [{ width: 100, height: 200 }],
      pixels,
    });
    const result = await tool.run({
      files: [PNG('tall.png')],
      options: { height: 100 },
    });
    expect(result.stats.width).toBe(50); // 1:2 aspect preserved
    expect(result.stats.height).toBe(100);
  });

  it('respects max colors setting', async () => {
    const pixels = new Uint8ClampedArray(20 * 20 * 4);
    for (let i = 0; i < 20 * 20; i++) {
      pixels[i * 4] = i * 10;
      pixels[i * 4 + 1] = 128;
      pixels[i * 4 + 2] = 64;
      pixels[i * 4 + 3] = 255;
    }
    mock = installImageMock({
      dimensions: [{ width: 20, height: 20 }],
      pixels,
    });
    const result = await tool.run({
      files: [PNG('colorful.png')],
      options: { colors: 16 },
    });
    expect(result.stats.colors).toBe(16);
  });

  it('toggles dithering', async () => {
    const pixels = new Uint8ClampedArray(20 * 20 * 4);
    for (let i = 0; i < 20 * 20; i++) {
      pixels[i * 4] = 128;
      pixels[i * 4 + 1] = 128;
      pixels[i * 4 + 2] = 128;
      pixels[i * 4 + 3] = 255;
    }
    mock = installImageMock({
      dimensions: [{ width: 20, height: 20 }],
      pixels,
    });
    const result = await tool.run({
      files: [PNG('gray.png')],
      options: { dither: false },
    });
    expect(result.stats.dither).toBe(false);
  });

  it('reports progress during processing', async () => {
    const progressCalls: Array<{ fraction: number; message?: string }> = [];
    const pixels = new Uint8ClampedArray(20 * 20 * 4);
    mock = installImageMock({
      dimensions: [
        { width: 20, height: 20 },
        { width: 20, height: 20 },
      ],
      pixels,
    });
    await tool.run({
      files: [PNG('f1.png'), PNG('f2.png')],
      options: {},
      onProgress: (frac, msg) => progressCalls.push({ fraction: frac, message: msg }),
    });
    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[progressCalls.length - 1].fraction).toBe(1);
  });

  it('cancels when signal is already aborted', async () => {
    mock = installImageMock({
      dimensions: [{ width: 50, height: 50 }],
      pixels: new Uint8ClampedArray(50 * 50 * 4),
    });
    await expect(tool.run({ files: [PNG('test.png')], options: {}, signal: AbortSignal.abort() })).rejects.toThrow(/cancelled/i);
  });

  it('rejects oversized source image', async () => {
    mock = installImageMock({ width: 20_000, height: 20_000 });
    await expect(tool.run({ files: [PNG('huge.png')], options: {} })).rejects.toThrow(/too large/i);
  });
});

describe('gif-maker meta', () => {
  it('has correct id and category', () => {
    expect(tool.meta.id).toBe('gif-maker');
    expect(tool.meta.category).toBe('image');
  });

  it('accepts multiple image files', () => {
    expect(tool.meta.input).toBe('file');
    expect(tool.meta.multiple).toBe(true);
    expect(tool.meta.accept).toBe('image/*');
  });

  it('has required options defined', () => {
    const optionKeys = tool.meta.options!.map((o) => o.key);
    expect(optionKeys).toContain('delay');
    expect(optionKeys).toContain('loop');
    expect(optionKeys).toContain('width');
    expect(optionKeys).toContain('height');
    expect(optionKeys).toContain('colors');
    expect(optionKeys).toContain('dither');
  });

  it('includes gifenc credit', () => {
    const creditNames = tool.meta.credits!.map((c) => c.name);
    expect(creditNames).toContain('gifenc');
  });

  it('has stable status and recent updated date', () => {
    expect(tool.meta.status).toBe('stable');
    expect(tool.meta.updated).toBe('2026-10-27');
  });
});