import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import tool, { intrinsicSize, outputSize } from './svg-to-png.tool';
import {
  blobPixels,
  installFakeImageEnv,
  pixelAt,
  resetFakeImageEnv,
  setFakeDecoder,
  svgFile,
} from './test-canvas';

describe('intrinsicSize', () => {
  it('reads pixel dimensions and viewBox dimensions', () => {
    expect(intrinsicSize('<svg width="120px" height="60px"></svg>')).toEqual({ w: 120, h: 60 });
    expect(intrinsicSize('<svg viewBox="0 0 24 12"></svg>')).toEqual({ w: 24, h: 12 });
  });
  it('uses viewBox for a missing explicit dimension', () => {
    expect(intrinsicSize('<svg width="100" viewBox="0 0 20 10"></svg>')).toEqual({ w: 100, h: 10 });
  });
  it('supports single-quoted attributes and a viewBox with a negative origin', () => {
    expect(intrinsicSize("<svg width='200' viewBox='-10 -10 20 10'></svg>")).toEqual({
      w: 200,
      h: 10,
    });
  });
  it('ignores percentage dimensions and falls back to the viewBox', () => {
    expect(intrinsicSize('<svg width="100%" height="100%" viewBox="0 0 30 15"></svg>')).toEqual({
      w: 30,
      h: 15,
    });
  });
  it('rejects non-SVG input and SVG without usable dimensions', () => {
    expect(() => intrinsicSize('<div/>')).toThrow(/not an SVG/i);
    expect(() => intrinsicSize('<svg></svg>')).toThrow(/determine the SVG dimensions/i);
    expect(() => intrinsicSize('<svg width="10"')).toThrow(/determine the SVG dimensions/i);
  });
});

describe('outputSize', () => {
  it('multiplies the intrinsic size by the scale by default', () => {
    expect(outputSize(10, 5, { scale: 2 })).toEqual({ w: 20, h: 10 });
  });
  it('falls back to a scale of 1 for malformed scale values', () => {
    expect(outputSize(10, 5, { scale: 0 })).toEqual({ w: 10, h: 5 });
    expect(outputSize(10, 5, { scale: Number.NaN })).toEqual({ w: 10, h: 5 });
  });
  it('treats a single override as an exact size and derives the other side', () => {
    expect(outputSize(10, 5, { width: 100 })).toEqual({ w: 100, h: 50 });
    expect(outputSize(10, 5, { height: 100 })).toEqual({ w: 200, h: 100 });
  });
  it('uses both overrides verbatim when supplied', () => {
    expect(outputSize(10, 5, { width: 40, height: 40 })).toEqual({ w: 40, h: 40 });
  });
});

describe('svg-to-png run', () => {
  beforeEach(() => installFakeImageEnv());
  afterEach(() => resetFakeImageEnv());

  const icon = '<svg width="10" height="10"></svg>';
  const svg = (markup: string, name = 'icon.svg') => svgFile(name, markup);

  it('rasterizes at 2× by default', async () => {
    const result = await tool.run({ files: [svg(icon)], options: {} });
    expect(result.outputs[0]!.filename).toBe('icon.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');
    expect(result.stats).toMatchObject({ width: 20, height: 20 });
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixels.length).toBe(20 * 20 * 4);
  });

  it('honours the scale option', async () => {
    const result = await tool.run({ files: [svg(icon)], options: { scale: 3 } });
    expect(result.stats).toMatchObject({ width: 30, height: 30 });
  });

  it('treats width and height overrides as exact sizes', async () => {
    const small = '<svg width="10" height="5"></svg>';
    const byWidth = await tool.run({ files: [svg(small)], options: { width: 100 } });
    expect(byWidth.stats).toMatchObject({ width: 100, height: 50 });
    const byHeight = await tool.run({ files: [svg(small)], options: { height: 100 } });
    expect(byHeight.stats).toMatchObject({ width: 200, height: 100 });
    const both = await tool.run({ files: [svg(small)], options: { width: 40, height: 40 } });
    expect(both.stats).toMatchObject({ width: 40, height: 40 });
  });

  it('rasterizes a viewBox-only SVG', async () => {
    const result = await tool.run({ files: [svg('<svg viewBox="0 0 24 12"/>')], options: {} });
    expect(result.stats).toMatchObject({ width: 48, height: 24 });
  });

  it('fills the background colour behind transparent artwork', async () => {
    const result = await tool.run({
      files: [svg(icon)],
      options: { scale: 1, background: '#123456' },
    });
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixelAt(pixels, 10, 0, 0)).toEqual([18, 52, 86, 255]);
    expect(pixelAt(pixels, 10, 9, 9)).toEqual([18, 52, 86, 255]);
  });

  it('leaves the canvas transparent by default', async () => {
    const result = await tool.run({ files: [svg(icon)], options: { scale: 1 } });
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixelAt(pixels, 10, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('keeps the file name when it has no .svg extension', async () => {
    const result = await tool.run({
      files: [svg('<svg width="2" height="2"/>', 'logo')],
      options: {},
    });
    expect(result.outputs[0]!.filename).toBe('logo.png');
  });

  it('rejects non-SVG and dimension-less input', async () => {
    await expect(tool.run({ files: [svg('<div/>')], options: {} })).rejects.toThrow(/not an SVG/i);
    await expect(tool.run({ files: [svg('<svg></svg>')], options: {} })).rejects.toThrow(
      /determine the SVG dimensions/i,
    );
  });

  it('rejects output sizes beyond the canvas limit', async () => {
    await expect(
      tool.run({ files: [svg('<svg width="9000" height="9000"></svg>')], options: { scale: 2 } }),
    ).rejects.toThrow(/out of range/i);
  });

  it('requires exactly one SVG file', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose one SVG file/i);
    await expect(tool.run({ files: [svg(icon), svg(icon)], options: {} })).rejects.toThrow(
      /Choose one SVG file/i,
    );
  });

  it('reports a friendly error when the browser cannot rasterize SVG', async () => {
    resetFakeImageEnv();
    await expect(tool.run({ files: [svg(icon)], options: {} })).rejects.toThrow(
      /cannot rasterize SVG/i,
    );
  });

  it('reports a friendly error for malformed SVG that cannot be decoded', async () => {
    setFakeDecoder(() => {
      throw new Error('boom');
    });
    await expect(tool.run({ files: [svg(icon)], options: {} })).rejects.toThrow(
      /could not be rasterized/i,
    );
  });

  it('honours an aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({ files: [svg(icon)], options: {}, signal: controller.signal }),
    ).rejects.toThrow(/cancelled/i);
  });
});
