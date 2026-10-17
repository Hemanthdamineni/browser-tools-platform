import { afterEach, describe, expect, it, vi } from 'vitest';
import tool, { MAX_SVG_BYTES, intrinsicSize, outputSize } from './svg-to-png.tool';
import { assertSafeSvg, isSafeReference, normalizeSvgSize } from './svg-safety';
import { blobPixels, installImageMock, pixelAt, svgFile, type MockHandle } from './image-mock';

let mock: MockHandle | undefined;
afterEach(() => {
  mock?.restore();
  mock = undefined;
});

describe('isSafeReference', () => {
  it('allows fragments and inline data URLs only', () => {
    expect(isSafeReference('#icon')).toBe(true);
    expect(isSafeReference('data:image/png;base64,AAAA')).toBe(true);
    expect(isSafeReference('')).toBe(true);
    expect(isSafeReference('https://evil.example/x.png')).toBe(false);
    expect(isSafeReference('//evil.example/x.png')).toBe(false);
    expect(isSafeReference('pic.png')).toBe(false);
    expect(isSafeReference('javascript:alert(1)')).toBe(false);
  });
});

describe('assertSafeSvg', () => {
  const ok = '<svg width="10" height="10"><rect width="10" height="10"/></svg>';
  it('accepts a plain, self-contained SVG', () => {
    expect(() => assertSafeSvg(ok)).not.toThrow();
  });
  it('allows internal fragments and data URLs', () => {
    expect(() =>
      assertSafeSvg('<svg><use href="#a"/><image href="data:image/png;base64,AAAA"/></svg>'),
    ).not.toThrow();
  });
  it('rejects scripts and embedded media', () => {
    expect(() => assertSafeSvg('<svg><script>alert(1)</script></svg>')).toThrow(/safely/i);
    expect(() => assertSafeSvg('<svg><foreignObject/></svg>')).toThrow(/safely/i);
  });
  it('rejects inline event handlers', () => {
    expect(() => assertSafeSvg('<svg onload="x()"></svg>')).toThrow(/event handlers/i);
  });
  it('rejects external references and CSS imports', () => {
    expect(() => assertSafeSvg('<svg><image href="https://evil.example/x.png"/></svg>')).toThrow(
      /external resource/i,
    );
    expect(() => assertSafeSvg('<svg><image href="pic.png"/></svg>')).toThrow(/external resource/i);
    expect(() =>
      assertSafeSvg('<svg><style>.a{background:url(https://x/a.png)}</style></svg>'),
    ).toThrow(/external resource from CSS/i);
    expect(() => assertSafeSvg('<svg><style>@import url("x.css");</style></svg>')).toThrow(
      /external stylesheet/i,
    );
  });
  it('rejects an external document type definition', () => {
    expect(() => assertSafeSvg('<!DOCTYPE svg SYSTEM "http://x/x.dtd"><svg/>')).toThrow(
      /document type definition/i,
    );
  });
});

describe('normalizeSvgSize', () => {
  it('injects an explicit pixel size on the root element', () => {
    expect(normalizeSvgSize('<svg viewBox="0 0 10 10"/>', 10, 10)).toBe(
      '<svg width="10" height="10" viewBox="0 0 10 10"/>',
    );
  });
  it('replaces percentage dimensions but keeps the viewBox', () => {
    expect(
      normalizeSvgSize('<svg width="100%" height="100%" viewBox="0 0 30 15"></svg>', 30, 15),
    ).toBe('<svg width="30" height="15" viewBox="0 0 30 15"></svg>');
  });
});

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
  const icon = '<svg width="10" height="10"></svg>';
  const svg = (markup: string, name = 'icon.svg') => svgFile(name, markup);
  const install = () => installImageMock({ pixelOutput: true });

  it('rasterizes at 2× by default', async () => {
    mock = install();
    const result = await tool.run({ files: [svg(icon)], options: {} });
    expect(result.outputs[0]!.filename).toBe('icon.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');
    expect(result.stats).toMatchObject({ width: 20, height: 20 });
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixels.length).toBe(20 * 20 * 4);
  });

  it('honours the scale option', async () => {
    mock = install();
    const result = await tool.run({ files: [svg(icon)], options: { scale: 3 } });
    expect(result.stats).toMatchObject({ width: 30, height: 30 });
  });

  it('treats width and height overrides as exact sizes', async () => {
    mock = install();
    const small = '<svg width="10" height="5"></svg>';
    const byWidth = await tool.run({ files: [svg(small)], options: { width: 100 } });
    expect(byWidth.stats).toMatchObject({ width: 100, height: 50 });
    const byHeight = await tool.run({ files: [svg(small)], options: { height: 100 } });
    expect(byHeight.stats).toMatchObject({ width: 200, height: 100 });
    const both = await tool.run({ files: [svg(small)], options: { width: 40, height: 40 } });
    expect(both.stats).toMatchObject({ width: 40, height: 40 });
  });

  it('rasterizes a viewBox-only SVG', async () => {
    mock = install();
    const result = await tool.run({ files: [svg('<svg viewBox="0 0 24 12"/>')], options: {} });
    expect(result.stats).toMatchObject({ width: 48, height: 24 });
  });

  it('fills the background colour behind transparent artwork', async () => {
    mock = install();
    const result = await tool.run({
      files: [svg(icon)],
      options: { scale: 1, background: '#123456' },
    });
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixelAt(pixels, 10, 0, 0)).toEqual([18, 52, 86, 255]);
    expect(pixelAt(pixels, 10, 9, 9)).toEqual([18, 52, 86, 255]);
  });

  it('leaves the canvas transparent by default', async () => {
    mock = install();
    const result = await tool.run({ files: [svg(icon)], options: { scale: 1 } });
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixelAt(pixels, 10, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('rejects an invalid background colour', async () => {
    mock = install();
    await expect(
      tool.run({ files: [svg(icon)], options: { background: 'midnight' } }),
    ).rejects.toThrow(/hex colour/i);
  });

  it('keeps the file name when it has no .svg extension', async () => {
    mock = install();
    const result = await tool.run({
      files: [svg('<svg width="2" height="2"/>', 'logo')],
      options: {},
    });
    expect(result.outputs[0]!.filename).toBe('logo.png');
  });

  it('handles a Unicode file name', async () => {
    mock = install();
    const result = await tool.run({
      files: [svg('<svg width="2" height="2"/>', '图 标.svg')],
      options: {},
    });
    expect(result.outputs[0]!.filename).toBe('图 标.png');
  });

  it('rejects non-SVG and dimension-less input', async () => {
    mock = installImageMock();
    await expect(tool.run({ files: [svg('<div/>')], options: {} })).rejects.toThrow(/not an SVG/i);
    await expect(tool.run({ files: [svg('<svg></svg>')], options: {} })).rejects.toThrow(
      /determine the SVG dimensions/i,
    );
    const text = new File(['<svg/>'], 'note.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [text], options: {} })).rejects.toThrow(/not an SVG/i);
  });

  it('blocks SVGs that reference external resources', async () => {
    mock = installImageMock();
    const evil = svg(
      '<svg width="10" height="10"><image href="https://evil.example/x.png"/></svg>',
    );
    await expect(tool.run({ files: [evil], options: {} })).rejects.toThrow(/external resource/i);
  });

  it('blocks SVGs containing scripts', async () => {
    mock = installImageMock();
    await expect(
      tool.run({
        files: [svg('<svg width="10" height="10"><script>x()</script></svg>')],
        options: {},
      }),
    ).rejects.toThrow(/safely/i);
  });

  it('rejects output sizes beyond the canvas budget', async () => {
    mock = installImageMock();
    await expect(
      tool.run({ files: [svg('<svg width="9000" height="9000"></svg>')], options: { scale: 2 } }),
    ).rejects.toThrow(/too large/i);
  });

  it('rejects an oversized SVG file before parsing it', async () => {
    mock = installImageMock();
    const big = new File([new Uint8Array(MAX_SVG_BYTES + 1)], 'big.svg', {
      type: 'image/svg+xml',
    });
    await expect(tool.run({ files: [big], options: {} })).rejects.toThrow(/too large/i);
  });

  it('requires exactly one SVG file', async () => {
    mock = installImageMock();
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose one SVG file/i);
    await expect(tool.run({ files: [svg(icon), svg(icon)], options: {} })).rejects.toThrow(
      /Choose one SVG file/i,
    );
  });

  it('reports a friendly error when the browser cannot rasterize SVG', async () => {
    await expect(tool.run({ files: [svg(icon)], options: {} })).rejects.toThrow(
      /cannot rasterize SVG/i,
    );
  });

  it('reports a friendly error for malformed SVG that cannot be decoded', async () => {
    mock = installImageMock();
    mock.setDecoder(() => {
      throw new Error('boom');
    });
    await expect(tool.run({ files: [svg(icon)], options: {} })).rejects.toThrow(
      /could not be rasterized/i,
    );
  });

  it('reports progress', async () => {
    mock = install();
    const onProgress = vi.fn();
    await tool.run({ files: [svg(icon)], options: {}, onProgress });
    expect(onProgress).toHaveBeenCalledWith(1, 'Done');
    expect(onProgress).toHaveBeenCalledWith(0, 'Reading SVG');
  });

  it('honours an aborted signal', async () => {
    mock = install();
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({ files: [svg(icon)], options: {}, signal: controller.signal }),
    ).rejects.toThrow(/cancelled/i);
  });
});
