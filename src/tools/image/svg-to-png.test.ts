import { describe, expect, it } from 'vitest';
import tool, { assertSafeSvg, intrinsicSize } from './svg-to-png.tool';

describe('intrinsicSize', () => {
  it('reads pixel dimensions and viewBox dimensions', () => {
    expect(intrinsicSize('<svg width="120px" height="60px"></svg>')).toEqual({ w: 120, h: 60 });
    expect(intrinsicSize('<svg viewBox="0 0 24 12"></svg>')).toEqual({ w: 24, h: 12 });
  });
  it('uses viewBox for a missing explicit dimension', () => {
    expect(intrinsicSize('<svg width="100" viewBox="0 0 20 10"></svg>')).toEqual({ w: 100, h: 10 });
  });
  it('rejects non-SVG input and SVG without usable dimensions', () => {
    expect(() => intrinsicSize('<div/>')).toThrow(/not an SVG/i);
    expect(() => intrinsicSize('<svg></svg>')).toThrow(/determine the SVG dimensions/i);
  });
});

describe('assertSafeSvg', () => {
  const sized = (body: string) => `<svg width="10" height="10">${body}</svg>`;

  it('allows a self-contained SVG', () => {
    expect(() => assertSafeSvg(sized('<rect width="10" height="10"/>'))).not.toThrow();
  });

  it('rejects external href, CSS url, and script constructs', () => {
    expect(() => assertSafeSvg(sized('<image href="https://example.com/x.png"/>'))).toThrow(
      /external resource/i,
    );
    expect(() => assertSafeSvg(sized('<image xlink:href="//cdn.example/x.png"/>'))).toThrow(
      /external resource/i,
    );
    expect(() =>
      assertSafeSvg(sized('<rect style="fill:url(https://example.com/x.png)"/>')),
    ).toThrow(/external resource/i);
    expect(() => assertSafeSvg(sized('<script>alert(1)</script>'))).toThrow(/active content/i);
    expect(() =>
      assertSafeSvg(sized('<foreignObject><iframe src="https://example.com"/></foreignObject>')),
    ).toThrow(/active content/i);
  });

  it('ignores comment content while rejecting active constructs elsewhere', () => {
    expect(() =>
      assertSafeSvg(sized('<!-- inert comment --> <image href="https://example.com/x.png"/>')),
    ).toThrow(/external resource/i);
    expect(() => assertSafeSvg(sized('<image href="https://example.com/x.png"/>'))).toThrow(
      /external resource/i,
    );
  });
});

describe('svg-to-png run', () => {
  it('requires exactly one SVG file', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose one SVG file/i);
  });
  it('rejects browser rasterization when createImageBitmap is unsupported', async () => {
    const file = new File(['<svg width="10" height="10"></svg>'], 'icon.svg', {
      type: 'image/svg+xml',
    });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow();
  });
});
