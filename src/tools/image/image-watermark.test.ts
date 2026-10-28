import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveOptions } from '@/lib/options';
import tool from './image-watermark.tool';
import {
  ESTIMATED_GLYPH_RATIO,
  MAX_TILE_MARKS,
  WATERMARK_POSITIONS,
  clampOpacity,
  computeLayout,
  dataUrlToBlob,
  estimateTextWidth,
  normalizePosition,
  resolveWatermarkSettings,
  rotatedHalfExtent,
  textFontPx,
  tileMarks,
  type WatermarkSettings,
} from './image-watermark.core';
import { meta } from './image-watermark.meta';
import { MockContext2D, installImageMock, makeFile, type MockHandle } from './image-mock';

/* -------------------------------------------------------------------------- */
/*  Test-local text support for the shared canvas mock                         */
/* -------------------------------------------------------------------------- */

/**
 * `image-mock.ts` models pixels and `drawImage`, but not text. Rather than
 * teach the shared mock about `fillText` (another workstream owns that file),
 * this file wraps the context's prototype locally: any member the mock is
 * missing is added, and `fillText` is wrapped so every text draw is recorded
 * with the transform, alpha and style that were live at the time. The wrapper
 * calls through to whatever the shared mock provides, so it keeps working if
 * the mock grows text support of its own.
 */
interface Transform {
  translate: [number, number];
  rotate: number;
  scale: [number, number];
}

interface PatchedContext {
  canvas: { width: number; height: number };
  transform?: Transform;
  globalAlpha?: number;
  font?: string;
  fillStyle: string;
  textAlign?: string;
  textBaseline?: string;
  save?: (this: PatchedContext) => void;
  restore?: (this: PatchedContext) => void;
  measureText?: (this: PatchedContext, text: string) => { width: number };
  fillText?: (this: PatchedContext, text: string, x: number, y: number) => void;
}

interface TextCall {
  text: string;
  /** Mark centre, taken from the live transform. */
  x: number;
  y: number;
  angle: number;
  alpha: number;
  font: string;
  fillStyle: string;
  textAlign: string;
  textBaseline: string;
}

const textCalls: TextCall[] = [];

function fontPxOf(font: string): number {
  const match = /([\d.]+)px/.exec(font);
  return match ? Number(match[1]) : 10;
}

function cloneTransform(transform?: Transform): Transform {
  return transform
    ? {
        translate: [transform.translate[0], transform.translate[1]],
        rotate: transform.rotate,
        scale: [transform.scale[0], transform.scale[1]],
      }
    : { translate: [0, 0], rotate: 0, scale: [1, 1] };
}

const proto = MockContext2D.prototype as unknown as PatchedContext;
const mockFillText = proto.fillText;
const mockHasSave = typeof proto.save === 'function';

if (typeof proto.measureText !== 'function') {
  proto.measureText = function (text: string): { width: number } {
    return {
      width: Math.max(1, [...text].length * fontPxOf(this.font ?? '') * ESTIMATED_GLYPH_RATIO),
    };
  };
}

proto.fillText = function (text: string, x: number, y: number): void {
  const transform = this.transform ?? { translate: [0, 0], rotate: 0, scale: [1, 1] };
  textCalls.push({
    text,
    x: transform.translate[0],
    y: transform.translate[1],
    angle: transform.rotate,
    alpha: typeof this.globalAlpha === 'number' ? this.globalAlpha : 1,
    font: this.font ?? '',
    fillStyle: String(this.fillStyle),
    textAlign: this.textAlign ?? 'start',
    textBaseline: this.textBaseline ?? 'alphabetic',
  });
  mockFillText?.call(this, text, x, y);
};

if (!mockHasSave) {
  proto.save = function (): void {
    const ctx = this as PatchedContext & {
      __wmStack?: { transform?: Transform; alpha?: number }[];
    };
    (ctx.__wmStack ??= []).push({
      transform: cloneTransform(this.transform),
      alpha: this.globalAlpha,
    });
  };
  proto.restore = function (): void {
    const ctx = this as PatchedContext & {
      __wmStack?: { transform?: Transform; alpha?: number }[];
    };
    const saved = ctx.__wmStack?.pop();
    if (!saved) return;
    this.transform = cloneTransform(saved.transform);
    this.globalAlpha = saved.alpha;
  };
}

/* -------------------------------------------------------------------------- */
/*  Harness                                                                    */
/* -------------------------------------------------------------------------- */

let mock: MockHandle | undefined;

beforeEach(() => {
  textCalls.length = 0;
});

afterEach(() => {
  mock?.restore();
  mock = undefined;
});

const PNG_LOGO = 'data:image/png;base64,AAAA';

const png = (name = 'photo.png') => makeFile(name, 'image/png');
const jpg = (name = 'photo.jpg') => makeFile(name, 'image/jpeg');

/** Options with the tool's own declared defaults applied, then overridden. */
const options = (over: Record<string, unknown> = {}) => ({ ...resolveOptions(meta, {}), ...over });

const settings = (over: Record<string, unknown> = {}): WatermarkSettings =>
  resolveWatermarkSettings(options(over) as never);

const runTool = (
  over: Record<string, unknown> = {},
  files: File[] = [png()],
  extra: { onProgress?: (fraction: number, message?: string) => void; signal?: AbortSignal } = {},
) => tool.run({ files, options: over as never, ...extra });

const xs = (calls: TextCall[]) => calls.map((call) => call.x);
const ys = (calls: TextCall[]) => calls.map((call) => call.y);

/** The distinct centre coordinates on one axis, ascending. */
const unique = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);

/** The largest gap between neighbouring centres on one axis. */
const largestGap = (sorted: number[]) =>
  sorted.reduce(
    (gap, value, index) => (index === 0 ? gap : Math.max(gap, value - sorted[index - 1]!)),
    0,
  );

/**
 * Assert the repeating pattern reaches both ends of `[0, limit]` on one axis:
 * a centre within `half` of each edge, and — when `gapless` — never a gap wider
 * than two half-extents, so no part of the canvas is left bare.
 */
function assertCoversAxis(values: number[], half: number, limit: number, gapless = true): void {
  const sorted = unique(values);
  expect(sorted[0]! - half).toBeLessThanOrEqual(1e-6);
  expect(sorted[sorted.length - 1]! + half).toBeGreaterThanOrEqual(limit - 1e-6);
  if (gapless) expect(largestGap(sorted)).toBeLessThanOrEqual(2 * half + 1e-6);
}

/* -------------------------------------------------------------------------- */
/*  Pure maths                                                                 */
/* -------------------------------------------------------------------------- */

describe('clampOpacity', () => {
  it('maps a percentage to a 0-1 alpha', () => {
    expect(clampOpacity(0)).toBe(0);
    expect(clampOpacity(50)).toBe(0.5);
    expect(clampOpacity(100)).toBe(1);
    expect(clampOpacity('25')).toBe(0.25);
  });

  it('clamps out-of-range and non-numeric values instead of propagating them', () => {
    expect(clampOpacity(140)).toBe(1);
    expect(clampOpacity(-20)).toBe(0);
    expect(clampOpacity(Number.NaN)).toBe(0);
    expect(clampOpacity('nonsense')).toBe(0);
    expect(clampOpacity(undefined)).toBe(0);
  });
});

describe('normalizePosition', () => {
  it('accepts every one of the nine anchors', () => {
    for (const position of WATERMARK_POSITIONS) expect(normalizePosition(position)).toBe(position);
  });

  it('defaults to the centre when omitted', () => {
    expect(normalizePosition(undefined)).toBe('center');
  });

  it('rejects an unknown position with a friendly error', () => {
    expect(() => normalizePosition('middle')).toThrow(/where the watermark sits/i);
  });
});

describe('textFontPx', () => {
  it('scales with the short edge, not the long one', () => {
    const wide = settings({ fontSize: 10 });
    expect(textFontPx(wide, 200, 100)).toBe(10);
    expect(textFontPx(wide, 100, 200)).toBe(10);
    expect(textFontPx(wide, 4000, 100)).toBe(10);
  });

  it('caps at the short edge for a 100% font', () => {
    expect(textFontPx(settings({ fontSize: 100 }), 640, 480)).toBe(480);
  });
});

describe('estimateTextWidth', () => {
  it('grows with both the glyph count and the font size', () => {
    const ten = estimateTextWidth('WATERMARK', 10);
    const twenty = estimateTextWidth('WATERMARK', 20);
    expect(ten).toBeCloseTo(9 * 10 * ESTIMATED_GLYPH_RATIO);
    expect(twenty).toBeCloseTo(ten * 2);
    expect(estimateTextWidth('', 10)).toBe(1);
  });
});

describe('rotatedHalfExtent', () => {
  it('is half the tile at 0°', () => {
    expect(rotatedHalfExtent(40, 20, 0)).toEqual({ rx: 20, ry: 10 });
  });

  it('swaps the axes at a quarter turn', () => {
    const { rx, ry } = rotatedHalfExtent(40, 20, Math.PI / 2);
    expect(rx).toBeCloseTo(10);
    expect(ry).toBeCloseTo(20);
  });

  it('inflates a square tile to its diagonal by 45°', () => {
    const { rx, ry } = rotatedHalfExtent(100, 100, Math.PI / 4);
    expect(rx).toBeCloseTo(100 / Math.SQRT2);
    expect(ry).toBeCloseTo(100 / Math.SQRT2);
  });
});

describe('tileMarks', () => {
  it('covers the whole canvas, padding by a rotated half-tile on every side', () => {
    const angle = (-30 * Math.PI) / 180;
    const marks = tileMarks(400, 300, 75, angle, 162, 36);
    const { rx, ry } = rotatedHalfExtent(162, 36, angle);
    const x = marks.map((m) => m.x);
    const y = marks.map((m) => m.y);
    expect(Math.min(...x)).toBeCloseTo(-rx);
    expect(Math.min(...y)).toBeCloseTo(-ry);
    expect(Math.max(...x)).toBeGreaterThanOrEqual(400);
    expect(Math.max(...y)).toBeGreaterThanOrEqual(300);
    // The grid grows until the last centre can cover the far edge.
    expect(Math.max(...x)).toBeLessThanOrEqual(400 + rx);
    expect(Math.max(...y)).toBeLessThanOrEqual(300 + ry);
  });

  it('uses the spacing as the step between centres', () => {
    const marks = tileMarks(100, 100, 25, 0, 10, 10);
    expect(marks[0]).toEqual({ x: -5, y: -5 });
    expect(marks[1]).toEqual({ x: 20, y: -5 });
    expect(marks.filter((m) => m.y === -5)).toHaveLength(5);
  });

  it('refuses a tiling that would stamp an absurd number of marks', () => {
    expect(() => tileMarks(20_000, 20_000, 1, 0, 1, 1)).toThrow(/too many times/i);
  });

  it('never returns more than the documented cap', () => {
    expect(MAX_TILE_MARKS).toBeGreaterThan(0);
    expect(() => tileMarks(1000, 1000, 0.5, 0, 1, 1)).toThrow(/too many times/i);
  });
});

describe('resolveWatermarkSettings', () => {
  it('accepts the tool defaults', () => {
    const s = resolveWatermarkSettings(resolveOptions(meta, {}));
    expect(s.mode).toBe('text');
    expect(s.text).toBe('WATERMARK');
    expect(s.opacity).toBe(50);
    expect(s.position).toBe('center');
    expect(s.tiled).toBe(false);
    expect(s.colorCss).toBe('rgb(0, 0, 0)');
    expect(s.colorHex).toBe('#000000');
  });

  it('normalises a short hex colour', () => {
    const s = settings({ color: '#F0a' });
    expect(s.colorCss).toBe('rgb(255, 0, 170)');
    expect(s.colorHex).toBe('#ff00aa');
  });

  it('treats the tiled checkbox string as a boolean', () => {
    expect(settings({ tiled: 'true' }).tiled).toBe(true);
    expect(settings({ tiled: 'false' }).tiled).toBe(false);
  });

  it('rejects an unknown mode', () => {
    expect(() => settings({ mode: 'blur' })).toThrow(/watermark type/i);
  });

  it('rejects empty and whitespace-only text', () => {
    expect(() => settings({ text: '' })).toThrow(/Enter the watermark text/i);
    expect(() => settings({ text: '   ' })).toThrow(/Enter the watermark text/i);
  });

  it('rejects an invalid colour', () => {
    expect(() => settings({ color: 'blue' })).toThrow(/hex colour/i);
    expect(() => settings({ color: '#12' })).toThrow(/hex colour/i);
    expect(() => settings({ color: '' })).toThrow(/hex colour/i);
  });

  it('rejects an out-of-range or non-numeric opacity', () => {
    expect(() => settings({ opacity: 140 })).toThrow(/between 0 and 100/i);
    expect(() => settings({ opacity: -1 })).toThrow(/between 0 and 100/i);
    expect(() => settings({ opacity: 'abc' })).toThrow(/not a number/i);
  });

  it('rejects an out-of-range angle but keeps the extremes', () => {
    expect(() => settings({ tiled: true, tileAngle: 400 })).toThrow(/between -180 and 180/i);
    expect(settings({ tiled: true, tileAngle: 180 }).tileAngle).toBe(180);
    expect(settings({ tiled: true, tileAngle: -180 }).tileAngle).toBe(-180);
  });

  it('requires a decodable-looking logo in logo mode', () => {
    expect(() => settings({ mode: 'logo', logo: '' })).toThrow(/Choose a logo image/i);
    expect(() => settings({ mode: 'logo', logo: 'https://example.com/logo.png' })).toThrow(
      /must be an image file/i,
    );
    expect(settings({ mode: 'logo', logo: PNG_LOGO }).logo).toBe(PNG_LOGO);
  });

  it('ignores the text and colour in logo mode', () => {
    const s = settings({ mode: 'logo', logo: PNG_LOGO, text: '', color: 'not-a-colour' });
    expect(s.mode).toBe('logo');
    expect(s.text).toBe('');
  });
});

/* -------------------------------------------------------------------------- */
/*  Layout                                                                     */
/* -------------------------------------------------------------------------- */

describe('computeLayout (single mark)', () => {
  it('centres the default text watermark and derives size from the short edge', () => {
    const layout = computeLayout({ settings: settings(), imageWidth: 200, imageHeight: 100 });
    expect(layout.tiled).toBe(false);
    expect(layout.angle).toBe(0);
    expect(layout.alpha).toBe(0.5);
    expect(layout.fontPx).toBe(10);
    expect(layout.tileWidth).toBeCloseTo(estimateTextWidth('WATERMARK', 10));
    expect(layout.tileHeight).toBeCloseTo(12);
    expect(layout.marks).toEqual([{ x: 100, y: 50 }]);
  });

  it('honours a measured text width over the estimate', () => {
    const layout = computeLayout({
      settings: settings(),
      imageWidth: 200,
      imageHeight: 100,
      textWidth: 111,
    });
    expect(layout.tileWidth).toBe(111);
  });

  it.each(WATERMARK_POSITIONS)('places the mark at %s', (position) => {
    const layout = computeLayout({
      settings: settings({ position, margin: 10 }),
      imageWidth: 200,
      imageHeight: 100,
    });
    const mark = layout.marks[0]!;
    const half = { w: layout.tileWidth / 2, h: layout.tileHeight / 2 };
    const margin = 10; // 10% of the 100px short edge
    const expectedX = position.includes('left')
      ? margin + half.w
      : position.includes('right')
        ? 200 - margin - half.w
        : 100;
    const expectedY = position.startsWith('top')
      ? margin + half.h
      : position.startsWith('bottom')
        ? 100 - margin - half.h
        : 50;
    expect(mark.x).toBeCloseTo(expectedX);
    expect(mark.y).toBeCloseTo(expectedY);
  });

  it('treats a zero margin as a flush edge', () => {
    const layout = computeLayout({
      settings: settings({ position: 'top-left', margin: 0 }),
      imageWidth: 80,
      imageHeight: 60,
    });
    expect(layout.marks[0]!.x).toBeCloseTo(layout.tileWidth / 2);
    expect(layout.marks[0]!.y).toBeCloseTo(layout.tileHeight / 2);
  });

  it('maps opacity through to alpha at both extremes', () => {
    expect(
      computeLayout({ settings: settings({ opacity: 0 }), imageWidth: 10, imageHeight: 10 }).alpha,
    ).toBe(0);
    expect(
      computeLayout({ settings: settings({ opacity: 100 }), imageWidth: 10, imageHeight: 10 })
        .alpha,
    ).toBe(1);
  });

  it('scales a logo to a percentage of the image width and keeps its aspect ratio', () => {
    const layout = computeLayout({
      settings: settings({ mode: 'logo', logo: PNG_LOGO, logoScale: 25 }),
      imageWidth: 200,
      imageHeight: 100,
      logoWidth: 40,
      logoHeight: 20,
    });
    expect(layout.tileWidth).toBe(50);
    expect(layout.tileHeight).toBe(25);
    expect(layout.fontPx).toBe(0);
    expect(layout.marks).toEqual([{ x: 100, y: 50 }]);
  });

  it('scales a logo with the image width, not the short edge', () => {
    const layout = computeLayout({
      settings: settings({ mode: 'logo', logo: PNG_LOGO, logoScale: 10 }),
      imageWidth: 400,
      imageHeight: 100,
      logoWidth: 1,
      logoHeight: 1,
    });
    expect(layout.tileWidth).toBe(40);
  });
});

describe('computeLayout (tiled)', () => {
  it('ignores the position and repeats over the whole canvas', () => {
    const layout = computeLayout({
      settings: settings({ tiled: true, tileSpacing: 25, tileAngle: -30, position: 'top-left' }),
      imageWidth: 400,
      imageHeight: 300,
      textWidth: 162,
    });
    expect(layout.tiled).toBe(true);
    expect(layout.angle).toBeCloseTo((-30 * Math.PI) / 180);
    expect(layout.marks.length).toBe(
      tileMarks(400, 300, 75, (-30 * Math.PI) / 180, 162, 36).length,
    );
    const x = layout.marks.map((m) => m.x);
    const y = layout.marks.map((m) => m.y);
    expect(Math.min(...x)).toBeLessThanOrEqual(0);
    expect(Math.min(...y)).toBeLessThanOrEqual(0);
    expect(Math.max(...x)).toBeGreaterThanOrEqual(400);
    expect(Math.max(...y)).toBeGreaterThanOrEqual(300);
  });

  it('derives the tile step from the short edge', () => {
    const layout = computeLayout({
      settings: settings({ tiled: true, tileSpacing: 50, tileAngle: 0 }),
      imageWidth: 400,
      imageHeight: 100,
      textWidth: 10,
    });
    expect(layout.marks[1]!.x - layout.marks[0]!.x).toBeCloseTo(50);
  });

  it('keeps tiles upright when the angle is zero', () => {
    const layout = computeLayout({
      settings: settings({ tiled: true, tileSpacing: 20, tileAngle: 0 }),
      imageWidth: 100,
      imageHeight: 100,
      textWidth: 10,
    });
    expect(layout.angle).toBe(0);
    expect(layout.marks[0]).toEqual({ x: -5, y: -6 });
  });
});

/* -------------------------------------------------------------------------- */
/*  data: URL decoding                                                        */
/* -------------------------------------------------------------------------- */

describe('dataUrlToBlob', () => {
  it('decodes a base64 data URL, keeping the MIME type', async () => {
    const blob = dataUrlToBlob('data:image/png;base64,AAAA');
    expect(blob.type).toBe('image/png');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([0, 0, 0]));
  });

  it('decodes a percent-encoded SVG logo', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    const blob = dataUrlToBlob(`data:image/svg+xml,${encodeURIComponent(svg)}`);
    expect(blob.type).toBe('image/svg+xml');
    expect(await blob.text()).toBe(svg);
  });

  it('defaults the MIME type when the header omits one', () => {
    expect(dataUrlToBlob('data:;base64,AAAA').type).toBe('image/png');
  });

  it('rejects a value that is not a data URL', () => {
    expect(() => dataUrlToBlob('https://example.com/logo.png')).toThrow(/not a valid data URL/i);
    expect(() => dataUrlToBlob('data:image/png')).toThrow(/not a valid data URL/i);
  });

  it('rejects a non-image payload', () => {
    expect(() => dataUrlToBlob('data:text/plain;base64,AAAA')).toThrow(/must be an image file/i);
  });

  it('rejects unreadable base64', () => {
    expect(() => dataUrlToBlob('data:image/png;base64,####')).toThrow(/could not be read/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  Run                                                                        */
/* -------------------------------------------------------------------------- */

describe('image-watermark run — text', () => {
  it('stamps the default text in the centre of one image', async () => {
    mock = installImageMock({ width: 200, height: 100 });
    const result = await runTool({});

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('photo-watermarked.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');
    expect(result.stats).toEqual({ files: 1 });

    const canvas = mock.canvases[0]!;
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);
    expect(canvas.draws[0]!.args.slice(1)).toEqual([0, 0]);

    expect(textCalls).toHaveLength(1);
    expect(textCalls[0]).toMatchObject({
      text: 'WATERMARK',
      x: 100,
      y: 50,
      font: 'bold 10px sans-serif',
      fillStyle: 'rgb(0, 0, 0)',
      textAlign: 'center',
      textBaseline: 'middle',
    });
    expect(textCalls[0]!.alpha).toBeCloseTo(0.5);
    expect(textCalls[0]!.angle).toBe(0);
  });

  it('scales the text with the short edge, not the long one', async () => {
    mock = installImageMock({ width: 1000, height: 200 });
    await runTool({ fontSize: 5 });
    expect(textCalls[0]!.font).toBe('bold 10px sans-serif');
  });

  it('places the mark at the requested corner, honouring the margin', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    await runTool({ text: 'HI', fontSize: 10, position: 'bottom-right', margin: 10 });
    // Short edge 100 → 10px font; measured width 2 × 6 = 12px; margin 10px.
    expect(textCalls[0]!.x).toBeCloseTo(100 - 10 - 6);
    expect(textCalls[0]!.y).toBeCloseTo(100 - 10 - 6);
  });

  it('applies the colour and opacity options', async () => {
    mock = installImageMock();
    await runTool({ color: '#ff0000', opacity: 15 });
    expect(textCalls[0]!.fillStyle).toBe('rgb(255, 0, 0)');
    expect(textCalls[0]!.alpha).toBeCloseTo(0.15);
  });

  it('draws fully transparent marks at 0% and opaque ones at 100%', async () => {
    mock = installImageMock();
    await runTool({ opacity: 0 });
    expect(textCalls[0]!.alpha).toBe(0);
    textCalls.length = 0;
    mock.restore();
    mock = installImageMock();
    await runTool({ opacity: 100 });
    expect(textCalls[0]!.alpha).toBe(1);
  });

  it('repeats and rotates the text across the whole canvas when tiled', async () => {
    mock = installImageMock({ width: 400, height: 300 });
    await runTool({ tiled: true, tileSpacing: 25, tileAngle: -30 });

    const expected = computeLayout({
      settings: settings({ tiled: true, tileSpacing: 25, tileAngle: -30 }),
      imageWidth: 400,
      imageHeight: 300,
      textWidth: estimateTextWidth('WATERMARK', 30),
    });
    expect(textCalls).toHaveLength(expected.marks.length);
    expect(textCalls.length).toBeGreaterThan(20);
    for (const call of textCalls) {
      expect(call.angle).toBeCloseTo((-30 * Math.PI) / 180);
      expect(call.text).toBe('WATERMARK');
    }

    // The grid straddles every edge and the tiles overlap, so the repeating
    // pattern reaches and covers the whole canvas — no bare patch is left.
    const { rx, ry } = rotatedHalfExtent(expected.tileWidth, expected.tileHeight, expected.angle);
    assertCoversAxis(xs(textCalls), rx, 400);
    assertCoversAxis(ys(textCalls), ry, 300);
    // Consecutive centres on the grid are exactly one tile spacing apart.
    expect(unique(xs(textCalls))[1]! - unique(xs(textCalls))[0]!).toBeCloseTo(0.25 * 300);
    expect(unique(ys(textCalls))[1]! - unique(ys(textCalls))[0]!).toBeCloseTo(0.25 * 300);
  });

  it('spaces tiles according to the tile spacing option', async () => {
    mock = installImageMock({ width: 300, height: 300 });
    await runTool({ tiled: true, tileSpacing: 50, tileAngle: 0 });
    const sorted = [...new Set(xs(textCalls))].sort((a, b) => a - b);
    expect(sorted[1]! - sorted[0]!).toBeCloseTo(150);
  });
});

describe('image-watermark run — logo', () => {
  it('stamps a logo scaled to a percentage of the image width', async () => {
    mock = installImageMock({
      dimensions: [
        { width: 40, height: 20 },
        { width: 200, height: 100 },
      ],
    });
    const result = await runTool({
      mode: 'logo',
      logo: PNG_LOGO,
      logoScale: 25,
      opacity: 80,
      position: 'top-left',
      margin: 5,
    });

    expect(result.outputs[0]!.filename).toBe('photo-watermarked.png');
    // The source image first, then the logo.
    const draws = mock.canvases[0]!.draws;
    expect(draws).toHaveLength(2);
    const logoDraw = draws[1]!;
    expect(logoDraw.destW).toBeCloseTo(50); // 25% of 200
    expect(logoDraw.destH).toBeCloseTo(25); // 50 × 20 / 40
    expect(logoDraw.args.slice(1)).toEqual([-25, -12.5, 50, 25]);
    // 5% margin of the 100px short edge, plus half the logo box.
    expect(logoDraw.transform!.translate).toEqual([30, 17.5]);
    expect(logoDraw.transform!.rotate).toBe(0);
    expect(textCalls).toHaveLength(0);
  });

  it('tiles the logo across the image with the tile angle', async () => {
    mock = installImageMock({
      dimensions: [
        { width: 20, height: 20 },
        { width: 200, height: 200 },
      ],
    });
    await runTool({
      mode: 'logo',
      logo: PNG_LOGO,
      logoScale: 10,
      tiled: true,
      tileSpacing: 25,
      tileAngle: 45,
    });

    const expected = computeLayout({
      settings: settings({
        mode: 'logo',
        logo: PNG_LOGO,
        logoScale: 10,
        tiled: true,
        tileSpacing: 25,
        tileAngle: 45,
      }),
      imageWidth: 200,
      imageHeight: 200,
      logoWidth: 20,
      logoHeight: 20,
    });
    // One draw for the source image plus one per tile.
    expect(mock.canvases[0]!.draws).toHaveLength(expected.marks.length + 1);
    expect(expected.marks.length).toBeGreaterThan(10);
    for (const draw of mock.canvases[0]!.draws.slice(1)) {
      expect(draw.destW).toBeCloseTo(20);
      expect(draw.destH).toBeCloseTo(20);
      expect(draw.transform!.rotate).toBeCloseTo(Math.PI / 4);
    }
    const { rx, ry } = rotatedHalfExtent(expected.tileWidth, expected.tileHeight, expected.angle);
    const tx = mock.canvases[0]!.draws.slice(1).map((d) => d.transform!.translate[0]);
    const ty = mock.canvases[0]!.draws.slice(1).map((d) => d.transform!.translate[1]);
    // A sparse logo tiling: the pattern reaches every edge, tiles need not touch.
    assertCoversAxis(tx, rx, 200, false);
    assertCoversAxis(ty, ry, 200, false);
    expect(unique(tx)[1]! - unique(tx)[0]!).toBeCloseTo(0.25 * 200);
  });

  it('closes the decoded logo as well as every image', async () => {
    mock = installImageMock({
      dimensions: [
        { width: 10, height: 10 },
        { width: 60, height: 60 },
      ],
    });
    await runTool({ mode: 'logo', logo: PNG_LOGO });
    expect(mock.bitmaps.map((b) => b.closed)).toEqual([true, true]);
  });
});

describe('image-watermark run — batch and formats', () => {
  it('processes every file, preserving order, and reports progress', async () => {
    mock = installImageMock();
    const onProgress = vi.fn();
    const result = await runTool({}, [png('a.png'), png('b.png'), png('c.png')], { onProgress });

    expect(result.outputs.map((o) => o.filename)).toEqual([
      'a-watermarked.png',
      'b-watermarked.png',
      'c-watermarked.png',
    ]);
    expect(result.stats).toEqual({ files: 3 });
    expect(mock.canvases).toHaveLength(3);
    expect(onProgress).toHaveBeenCalledWith(0, 'Watermarking a.png');
    expect(onProgress).toHaveBeenCalledWith(1, 'Done');
  });

  it.each([
    ['png', 'png', 'image/png'],
    ['jpeg', 'jpg', 'image/jpeg'],
    ['webp', 'webp', 'image/webp'],
  ] as const)('exports %s output as .%s', async (format, ext, mime) => {
    mock = installImageMock();
    const result = await runTool({ format });
    expect(result.outputs[0]!.filename).toBe(`photo-watermarked.${ext}`);
    expect(result.outputs[0]!.blob.type).toBe(mime);
  });

  it('keeps the source format by default', async () => {
    mock = installImageMock();
    const result = await runTool({ format: 'original' }, [jpg('pic.jpg')]);
    expect(result.outputs[0]!.filename).toBe('pic-watermarked.jpg');
    expect(result.outputs[0]!.blob.type).toBe('image/jpeg');
  });

  it('flattens transparency onto white for JPEG output', async () => {
    mock = installImageMock({ width: 40, height: 20 });
    await runTool({ format: 'jpeg' });
    expect(mock.canvases[0]!.fills[0]).toEqual({ x: 0, y: 0, w: 40, h: 20, style: '#ffffff' });
  });

  it.each(['png', 'webp'] as const)('keeps alpha and does not flatten for %s', async (format) => {
    mock = installImageMock({ width: 40, height: 20 });
    await runTool({ format });
    expect(mock.canvases[0]!.fills.some((f) => f.w === 40 && f.h === 20)).toBe(false);
  });

  it('requests EXIF orientation while decoding', async () => {
    mock = installImageMock();
    await runTool({}, [jpg('photo.jpg')]);
    expect(mock.bitmaps[0]!.options).toEqual({ imageOrientation: 'from-image' });
  });

  it('keeps Unicode filenames intact', async () => {
    mock = installImageMock();
    const result = await runTool({}, [png('фото-日本語.png')]);
    expect(result.outputs[0]!.filename).toBe('фото-日本語-watermarked.png');
  });

  it('closes each decoded bitmap', async () => {
    mock = installImageMock();
    await runTool({}, [png('a.png'), png('b.png')]);
    expect(mock.bitmaps.map((b) => b.closed)).toEqual([true, true]);
  });
});

describe('image-watermark run — failures', () => {
  it('rejects an empty selection before decoding anything', async () => {
    mock = installImageMock();
    await expect(runTool({}, [])).rejects.toThrow(/Choose an image file/i);
    expect(mock.bitmaps).toHaveLength(0);
  });

  it('rejects a non-image file', async () => {
    const txt = new File(['x'], 'a.txt', { type: 'text/plain' });
    await expect(runTool({}, [txt])).rejects.toThrow(/not an image/i);
  });

  it('rejects empty text before touching a pixel', async () => {
    mock = installImageMock();
    await expect(runTool({ text: '   ' })).rejects.toThrow(/Enter the watermark text/i);
    expect(mock.bitmaps).toHaveLength(0);
    expect(mock.canvases).toHaveLength(0);
  });

  it('rejects an invalid colour before touching a pixel', async () => {
    mock = installImageMock();
    await expect(runTool({ color: 'chartreuse' })).rejects.toThrow(/hex colour/i);
    expect(mock.bitmaps).toHaveLength(0);
  });

  it('rejects an out-of-range opacity', async () => {
    mock = installImageMock();
    await expect(runTool({ opacity: 140 })).rejects.toThrow(/between 0 and 100/i);
  });

  it('rejects an out-of-range tile angle', async () => {
    mock = installImageMock();
    await expect(runTool({ tiled: true, tileAngle: 400 })).rejects.toThrow(/between -180 and 180/i);
  });

  it('rejects an unknown position', async () => {
    mock = installImageMock();
    await expect(runTool({ position: 'middle' })).rejects.toThrow(/where the watermark sits/i);
  });

  it('rejects a missing or non-image logo', async () => {
    mock = installImageMock();
    await expect(runTool({ mode: 'logo', logo: '' })).rejects.toThrow(/Choose a logo image/i);
    await expect(runTool({ mode: 'logo', logo: 'https://x/logo.png' })).rejects.toThrow(
      /must be an image file/i,
    );
    expect(mock.bitmaps).toHaveLength(0);
  });

  it('surfaces a friendly error when the logo cannot be decoded', async () => {
    mock = installImageMock();
    // The logo data URL decodes to a 3-byte Blob; `makeFile` images are larger.
    mock.setDecoder((source) => {
      if (source.size === 3) throw new Error('bad logo bytes');
      return { width: 40, height: 40 };
    });
    await expect(runTool({ mode: 'logo', logo: PNG_LOGO })).rejects.toThrow(
      /logo image could not be decoded/i,
    );
    expect(mock.canvases).toHaveLength(0);
  });

  it('surfaces a friendly error when the image cannot be decoded', async () => {
    mock = installImageMock({ failDecode: true });
    await expect(runTool({}, [makeFile('bad.png')])).rejects.toThrow(/could not be decoded/i);
  });

  it('rejects a zero-size image with a clear message', async () => {
    mock = installImageMock({ dimensions: [{ width: 0, height: 0 }] });
    await expect(runTool({})).rejects.toThrow(/no measurable size/i);
  });

  it('rejects an oversized source image instead of crashing the tab', async () => {
    mock = installImageMock({ width: 20_000, height: 20_000 });
    await expect(runTool({}, [makeFile('huge.png')])).rejects.toThrow(/too large/i);
  });

  it('surfaces a friendly error when the browser cannot encode the format', async () => {
    mock = installImageMock({ supports: ['image/png'] });
    await expect(runTool({ format: 'webp' })).rejects.toThrow(/cannot encode webp/i);
  });

  it('honours an aborted signal', async () => {
    mock = installImageMock();
    await expect(runTool({}, [png()], { signal: AbortSignal.abort() })).rejects.toThrow(/cancel/i);
  });

  it('stops a long tiling as soon as the signal aborts', async () => {
    mock = installImageMock({ width: 4000, height: 4000 });
    const controller = new AbortController();
    controller.abort();
    await expect(
      runTool({ tiled: true, tileSpacing: 1, tileAngle: 45 }, [png()], {
        signal: controller.signal,
      }),
    ).rejects.toThrow(/cancel/i);
  });
});
