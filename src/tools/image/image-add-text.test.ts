import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveOptions } from '@/lib/options';
import tool from './image-add-text.tool';
import { meta } from './image-add-text.meta';
import {
  FONT_STACKS,
  clampAnchor,
  dragToAnchor,
  drawCaption,
  fromPercent,
  planCaption,
  previewSize,
  readTextOptions,
  splitGraphemes,
  toPercent,
  wrapText,
  type Alignment,
  type MeasureFn,
} from './image-add-text.core';
import { context2d, createCanvas } from './image-batch';
import { installImageMock, makeFile, type MockHandle } from './image-mock';

let mock: MockHandle | undefined;
afterEach(() => {
  mock?.restore();
  mock = undefined;
});

/** Deterministic 0.5em-per-code-point measure for the pure tests. */
const measure: MeasureFn = (text, fontPx) => [...text].length * fontPx * 0.5;

/** The same model inside the canvas mock, so preview and worker agree. */
const textWidth = (text: string, fontPx: number) => [...text].length * fontPx * 0.5;

/** Validated options straight from the tool's own defaults + overrides. */
const optionsFor = (overrides: Record<string, unknown> = {}) =>
  readTextOptions(resolveOptions(meta, { text: 'Hi', ...overrides }));

const wrap = (text: string, maxWidth: number, fontPx = 20) =>
  wrapText(text, maxWidth, measure, fontPx, FONT_STACKS.sans!);

describe('wrapText', () => {
  it('wraps greedy lines at several maximum widths', () => {
    const text = 'aaaa bbbb cccc';
    // 0.5em per character at 20px → 10px per character, 40px per word.
    expect(wrap(text, 200)).toEqual(['aaaa bbbb cccc']);
    expect(wrap(text, 139)).toEqual(['aaaa bbbb', 'cccc']);
    expect(wrap(text, 89)).toEqual(['aaaa', 'bbbb', 'cccc']);
    expect(wrap(text, 45)).toEqual(['aaaa', 'bbbb', 'cccc']);
  });

  it('hard-breaks a single word wider than the maximum width', () => {
    expect(wrap('aaaa', 30)).toEqual(['aaa', 'a']);
    expect(wrap('aaaaaaaaaaaa', 50)).toEqual(['aaaaa', 'aaaaa', 'aa']);
  });

  it('never loses characters when a word must be broken', () => {
    const text = 'supercalifragilistic expialidocious';
    const lines = wrap(text, 45);
    expect(lines.length).toBeGreaterThan(3);
    expect(lines.join('')).toBe(text.replace(/\s+/g, ''));
    for (const line of lines) expect(measure(line, 20, FONT_STACKS.sans!)).toBeLessThanOrEqual(45);
  });

  it('returns a single empty line for empty or whitespace-only text', () => {
    expect(wrap('', 100)).toEqual(['']);
    expect(wrap('   ', 100)).toEqual(['']);
    expect(wrap('\n \t\n', 100)).toEqual(['']);
  });

  it('keeps explicit line breaks, including blank lines between them', () => {
    expect(wrap('first line\nsecond line', 400)).toEqual(['first line', 'second line']);
    expect(wrap('a\n\nb', 400)).toEqual(['a', '', 'b']);
  });

  it('collapses runs of spaces and tabs inside a line', () => {
    expect(wrap('one   two\t\tthree', 400)).toEqual(['one two three']);
  });

  it('keeps a cluster that alone exceeds the width on its own line', () => {
    // 'X' is 100px wide, everything else 10px per character.
    const wide: MeasureFn = (text) =>
      [...text].reduce((sum, char) => sum + (char === 'X' ? 100 : 10), 0);
    const lines = wrapText('ab X cd', 50, wide, 20, FONT_STACKS.sans!);
    expect(lines).toEqual(['ab', 'X', 'cd']);
    expect(wide('X', 20, FONT_STACKS.sans!)).toBeGreaterThan(50);
  });

  it('rejects a non-positive maximum width', () => {
    expect(() => wrap('a', 0)).toThrow(/greater than zero/i);
    expect(() => wrap('a', -10)).toThrow(/greater than zero/i);
  });
});

describe('Unicode handling', () => {
  it('splits grapheme clusters so emoji and composed characters stay whole', () => {
    expect(splitGraphemes('a👨‍👩‍👧b')).toEqual(['a', '👨‍👩‍👧', 'b']);
    expect(splitGraphemes('e\u0301')).toEqual(['e\u0301']);
    expect(splitGraphemes('🇬🇧!')).toEqual(['🇬🇧', '!']);
  });

  it('breaks emoji between clusters, never through one', () => {
    const lines = wrapText('👍👍👍', 20, measure, 20, FONT_STACKS.sans!);
    expect(lines).toEqual(['👍👍', '👍']);
    for (const line of lines) expect(splitGraphemes(line).join('')).toBe(line);
  });

  it('measures and wraps accented and wide text without mangling it', () => {
    const lines = wrapText('café crème ☕ tea', 60, measure, 20, FONT_STACKS.sans!);
    expect(lines.join(' ')).toBe('café crème ☕ tea');
  });
});

describe('readTextOptions', () => {
  it('applies the tool defaults and normalises the text', () => {
    const o = readTextOptions(resolveOptions(meta, { text: '  Hello\r\nworld  ' }));
    expect(o).toMatchObject({
      text: '  Hello\nworld',
      font: 'sans',
      size: 8,
      color: '#ffffff',
      align: 'center',
      wrapWidth: 80,
      x: 50,
      y: 85,
      uppercase: false,
      shadow: false,
      opacity: 100,
      strokeWidth: 0,
      strokeColor: '#000000',
    });
    expect(o.shadowBlur).toBe(8);
  });

  it('honours every flag and colour override', () => {
    const o = optionsFor({
      text: 'Hello',
      font: 'impact',
      size: 12,
      color: '#FF0000',
      align: 'right',
      wrapWidth: 45,
      x: 10.5,
      y: 90.25,
      uppercase: true,
      opacity: 40,
      strokeWidth: 12,
      strokeColor: 'rgb(0, 0, 0)',
      shadow: true,
      shadowBlur: 3,
      shadowOffsetX: -4,
      shadowOffsetY: 5,
      shadowColor: '#00000080',
    });
    expect(o).toMatchObject({
      font: 'impact',
      size: 12,
      color: '#ff0000',
      align: 'right',
      wrapWidth: 45,
      x: 10.5,
      y: 90.25,
      uppercase: true,
      opacity: 40,
      strokeWidth: 12,
      strokeColor: 'rgb(0, 0, 0)',
      shadow: true,
      shadowBlur: 3,
      shadowOffsetX: -4,
      shadowOffsetY: 5,
      shadowColor: '#00000080',
    });
  });

  it('accepts boolean and string flag values', () => {
    expect(optionsFor({ uppercase: 'true', shadow: true }).uppercase).toBe(true);
    expect(optionsFor({ uppercase: 'false', shadow: false }).shadow).toBe(false);
  });

  it('rejects empty text', () => {
    expect(() => readTextOptions(resolveOptions(meta, {}))).toThrow(/Enter the text/i);
    expect(() => readTextOptions(resolveOptions(meta, { text: '   \n ' }))).toThrow(
      /Enter the text/i,
    );
  });

  it('rejects an unknown font', () => {
    expect(() => optionsFor({ font: 'comic-sans' })).toThrow(/Unknown font/i);
    expect(() => optionsFor({ font: '' })).toThrow(/Unknown font/i);
  });

  it('rejects an unknown alignment', () => {
    expect(() => optionsFor({ align: 'justify' })).toThrow(/Unknown alignment/i);
  });

  it('rejects malformed colours', () => {
    expect(() => optionsFor({ color: 'blue' })).toThrow(/valid text colour/i);
    expect(() => optionsFor({ strokeColor: '#12' })).toThrow(/valid outline colour/i);
    expect(() => optionsFor({ shadow: true, shadowColor: 'rgba(1)' })).toThrow(
      /valid shadow colour/i,
    );
    expect(optionsFor({ color: 'transparent' }).color).toBe('transparent');
  });

  it('rejects an unknown or out-of-range font size', () => {
    expect(() => optionsFor({ size: 'huge' })).toThrow(/Enter a number for the font size/i);
    expect(() => optionsFor({ size: '' })).toThrow(/Enter a number for the font size/i);
    expect(() => optionsFor({ size: 0 })).toThrow(/font size must be between/i);
    expect(() => optionsFor({ size: 500 })).toThrow(/font size must be between/i);
  });

  it('rejects out-of-range positions, wrap width and opacity', () => {
    expect(() => optionsFor({ x: -1 })).toThrow(/horizontal position must be between/i);
    expect(() => optionsFor({ y: 101 })).toThrow(/vertical position must be between/i);
    expect(() => optionsFor({ wrapWidth: 2 })).toThrow(/maximum line width must be between/i);
    expect(() => optionsFor({ opacity: 120 })).toThrow(/opacity must be between/i);
    expect(() => optionsFor({ strokeWidth: -1 })).toThrow(/outline width must be between/i);
  });
});

describe('planCaption', () => {
  it('sizes the font from the image short edge and builds the CSS font string', () => {
    const plan = planCaption(measure, optionsFor({ text: 'Hi', font: 'serif', size: 10 }), 400, 200);
    expect(plan.fontPx).toBe(20);
    expect(plan.font).toBe(`20px ${FONT_STACKS.serif}`);
    expect(plan.lineHeight).toBe(24);
    expect(plan.lines).toEqual(['Hi']);
    expect(plan.box).toEqual({ left: 200 - 10, top: 170 - 12, width: 20, height: 24 });
  });

  it('honours uppercase, opacity, outline and shadow', () => {
    const plan = planCaption(
      measure,
      optionsFor({
        text: 'Hi',
        uppercase: true,
        opacity: 50,
        strokeWidth: 10,
        strokeColor: '#123456',
        shadow: true,
        shadowBlur: 7,
        shadowOffsetX: 3,
        shadowOffsetY: -2,
        shadowColor: '#000000b3',
      }),
      400,
      200,
    );
    expect(plan.lines).toEqual(['HI']);
    expect(plan.opacity).toBe(0.5);
    // Default size 8% of the 200px short edge → 16px font; 10% of that is 1.6px.
    expect(plan.fontPx).toBe(16);
    expect(plan.strokeWidth).toBeCloseTo(1.6, 10);
    expect(plan.strokeColor).toBe('#123456');
    expect(plan.shadow).toEqual({ blur: 7, offsetX: 3, offsetY: -2, color: '#000000b3' });
  });

  it('has no outline and no shadow by default', () => {
    const plan = planCaption(measure, optionsFor({ text: 'Hi' }), 400, 200);
    expect(plan.strokeWidth).toBe(0);
    expect(plan.shadow).toBeNull();
  });

  it('wraps to the maximum line width percentage of the image width', () => {
    const plan = planCaption(
      measure,
      optionsFor({ text: 'aaaaaaaaaa bbbbbbbbbb cccccccccc', size: 5, wrapWidth: 30 }),
      400,
      200,
    );
    // fontPx = 5% × 200 = 10 → 5px per character; 30% × 400 = 120px per line.
    expect(plan.fontPx).toBe(10);
    expect(plan.lines).toEqual(['aaaaaaaaaa bbbbbbbbbb', 'cccccccccc']);
  });

  it('places each alignment around the anchor', () => {
    const left = planCaption(measure, optionsFor({ text: 'Hi', align: 'left', x: 0 }), 400, 200);
    expect(left.box).toMatchObject({ left: 0, width: 16 });
    // Default size 8% of the 200px short edge → 16px font, 19.2px line height.
    expect(left.box.height).toBeCloseTo(19.2, 10);
    expect(left.box.top).toBeCloseTo(160.4, 10);
    const center = planCaption(
      measure,
      optionsFor({ text: 'Hi', align: 'center', x: 50 }),
      400,
      200,
    );
    expect(center.box.left).toBe(192);
    const right = planCaption(measure, optionsFor({ text: 'Hi', align: 'right', x: 100 }), 400, 200);
    expect(right.box.left).toBe(384);
  });

  it('clamps the block inside the canvas at every edge', () => {
    const box = (x: number, y: number, align: Alignment) =>
      planCaption(measure, optionsFor({ text: 'Hi', x, y, align }), 400, 200).box;
    // Whatever the alignment, an out-of-range anchor is pulled back so the
    // whole block stays on the canvas: flush left/top, or flush right/bottom.
    for (const align of ['left', 'center', 'right'] as const) {
      expect(box(0, 0, align).left).toBeCloseTo(0, 10);
      expect(box(0, 0, align).top).toBeCloseTo(0, 10);
      expect(box(100, 100, align).left).toBeCloseTo(384, 10);
      expect(box(100, 100, align).top).toBeCloseTo(180.8, 10);
    }
  });

  it('rejects a canvas with no drawable area', () => {
    expect(() => planCaption(measure, optionsFor({ text: 'Hi' }), 0, 200)).toThrow(
      /no drawable area/i,
    );
  });

  it('rejects a font size that rounds below a pixel', () => {
    expect(() => planCaption(measure, optionsFor({ text: 'Hi', size: 1 }), 2, 2)).toThrow(
      /smaller than one pixel/i,
    );
  });
});

describe('position mapping', () => {
  it('clamps a block inside the canvas for every alignment and edge', () => {
    const block = { width: 100, height: 40 };
    const cases: [('left' | 'center' | 'right'), number, number, number, number][] = [
      ['left', -50, -50, 0, 20],
      ['left', 9999, 9999, 300, 180],
      ['center', -50, -50, 50, 20],
      ['center', 9999, 9999, 350, 180],
      ['right', -50, -50, 100, 20],
      ['right', 9999, 9999, 400, 180],
    ];
    for (const [align, x, y, ex, ey] of cases) {
      expect(clampAnchor(x, y, block.width, block.height, align, 400, 200)).toEqual({
        x: ex,
        y: ey,
      });
    }
  });

  it('centres a block larger than the canvas', () => {
    expect(clampAnchor(0, 0, 500, 300, 'left', 400, 200)).toEqual({ x: 200, y: 100 });
    expect(clampAnchor(9999, 9999, 500, 300, 'right', 400, 200)).toEqual({ x: 200, y: 100 });
  });

  it('round-trips positions through percentages', () => {
    for (const point of [
      { x: 0, y: 0 },
      { x: 123.5, y: 45.25 },
      { x: 1200, y: 800 },
    ]) {
      const percent = toPercent(point, 1200, 800);
      expect(percent).toEqual({ x: (point.x / 1200) * 100, y: (point.y / 800) * 100 });
      const back = fromPercent(percent, 1200, 800);
      expect(back.x).toBeCloseTo(point.x, 10);
      expect(back.y).toBeCloseTo(point.y, 10);
    }
  });

  it('rejects a canvas with no drawable area when converting', () => {
    expect(() => toPercent({ x: 0, y: 0 }, 0, 0)).toThrow(/no drawable area/i);
  });

  it('maps a drag on a scaled preview to the same anchor as a direct x/y', () => {
    // A 4000 × 3000 image previewed at 0.5 scale: a CSS point at (100, 50)
    // becomes the canvas point (200, 100), and the user grabbed the block at
    // (100, 40) inside it.
    const anchor = dragToAnchor(
      { x: 200, y: 100 },
      { x: 100, y: 40 },
      { width: 100, height: 40 },
      'center',
      4000,
      3000,
    );
    expect(anchor).toEqual({ x: 150, y: 80 });
    const percent = toPercent(anchor, 4000, 3000);
    expect(percent).toEqual({ x: 3.75, y: (80 / 3000) * 100 });

    // Dragging, then setting the same percentages by hand, plans identically.
    const dragged = planCaption(
      measure,
      optionsFor({ text: 'Hi', size: 1, x: percent.x, y: percent.y }),
      4000,
      3000,
    );
    const typed = planCaption(
      measure,
      optionsFor({ text: 'Hi', size: 1, x: 3.75, y: (80 / 3000) * 100 }),
      4000,
      3000,
    );
    expect(dragged.x).toBeCloseTo(150, 10);
    expect(dragged.y).toBeCloseTo(80, 10);
    expect(dragged).toEqual(typed);
  });

  it('keeps the block under the pointer when it is grabbed by its middle', () => {
    // Grabbing the block's own centre must not move it at all.
    expect(
      dragToAnchor({ x: 250, y: 120 }, { x: 50, y: 20 }, { width: 100, height: 40 }, 'center', 400, 200),
    ).toEqual({ x: 250, y: 120 });
  });

  it('clamps a drag past the canvas edge onto the edge', () => {
    expect(
      dragToAnchor({ x: -999, y: -999 }, { x: 0, y: 0 }, { width: 100, height: 40 }, 'center', 400, 200),
    ).toEqual({ x: 50, y: 20 });
    expect(
      dragToAnchor({ x: 9999, y: 9999 }, { x: 0, y: 0 }, { width: 100, height: 40 }, 'center', 400, 200),
    ).toEqual({ x: 350, y: 180 });
  });
});

describe('previewSize', () => {
  it('keeps small images at their natural size', () => {
    expect(previewSize(1000, 500)).toEqual({ width: 1000, height: 500, scale: 1 });
  });

  it('scales large images down to the pixel budget, preserving the aspect ratio', () => {
    const size = previewSize(4000, 3000, 2_000_000);
    expect(size.scale).toBeLessThan(1);
    expect(size.width * size.height).toBeLessThanOrEqual(2_100_000);
    expect(size.width / size.height).toBeCloseTo(4000 / 3000, 2);
  });

  it('rejects an image with no drawable area', () => {
    expect(() => previewSize(0, 100)).toThrow(/no drawable area/i);
  });
});

describe('drawCaption', () => {
  it('draws one fill per non-empty wrapped line, centred on the anchor', () => {
    mock = installImageMock({ textWidth });
    const ctx = context2d(createCanvas(400, 200));
    const plan = planCaption(
      measure,
      optionsFor({ text: 'aaaa bbbb cccc', wrapWidth: 10 }),
      400,
      200,
    );
    expect(plan.lines).toEqual(['aaaa', 'bbbb', 'cccc']);
    drawCaption(ctx, plan);
    const texts = mock.canvases[0]!.texts;
    expect(texts.map((t) => t.text)).toEqual(plan.lines);
    expect(texts.every((t) => t.kind === 'fill')).toBe(true);
    expect(texts.map((t) => t.y)).toEqual(
      plan.lines.map((_, i) => 170 + (i - (plan.lines.length - 1) / 2) * plan.lineHeight),
    );
    expect(texts[0]).toMatchObject({ x: 200, align: 'center', baseline: 'middle', alpha: 1 });
  });

  it('draws the outline under the fill and clears the shadow between them', () => {
    mock = installImageMock({ textWidth });
    const ctx = context2d(createCanvas(400, 200));
    const plan = planCaption(
      measure,
      optionsFor({ text: 'Hi', strokeWidth: 10, shadow: true, shadowBlur: 5 }),
      400,
      200,
    );
    drawCaption(ctx, plan);
    const [stroke, fill] = mock.canvases[0]!.texts;
    expect(stroke).toMatchObject({ kind: 'stroke', lineWidth: 1.6, style: '#000000' });
    expect(stroke!.shadow).toEqual({ color: '#000000b3', blur: 5, offsetX: 2, offsetY: 2 });
    expect(fill).toMatchObject({ kind: 'fill', style: '#ffffff' });
    expect(fill!.shadow.blur).toBe(0);
    expect(fill!.shadow.color).toBe('transparent');
  });

  it('skips empty lines (blank paragraphs) while keeping the spacing', () => {
    mock = installImageMock({ textWidth });
    const ctx = context2d(createCanvas(400, 200));
    const plan = planCaption(measure, optionsFor({ text: 'a\n\nb' }), 400, 200);
    drawCaption(ctx, plan);
    const texts = mock.canvases[0]!.texts;
    expect(texts.map((t) => t.text)).toEqual(['a', 'b']);
    // The blank paragraph still occupies a line: two line heights apart (16px font).
    expect(texts[1]!.y - texts[0]!.y).toBeCloseTo(38.4, 5);
  });

  it('restores the context state it changed', () => {
    mock = installImageMock({ textWidth });
    const ctx = context2d(createCanvas(400, 200));
    const before = { font: ctx.font, align: ctx.textAlign, alpha: ctx.globalAlpha };
    drawCaption(ctx, planCaption(measure, optionsFor({ text: 'Hi', opacity: 20 }), 400, 200));
    expect({ font: ctx.font, align: ctx.textAlign, alpha: ctx.globalAlpha }).toEqual(before);
  });
});

describe('image-add-text meta', () => {
  it('stays inside the registry rules', () => {
    expect(meta.id).toBe('image-add-text');
    expect(meta.summary.length).toBeLessThanOrEqual(120);
    expect(meta.status).toBe('beta');
    expect(meta.panel).toBe('image-add-text');
    expect(meta.accept).toBe('image/png,image/jpeg,image/webp');
    expect(meta.multiple).toBeFalsy();
    expect(meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
    expect(meta.updated).toBe('2026-10-24');
  });

  it('declares options for every branch the tool reads', () => {
    const keys = (meta.options ?? []).map((o) => o.key);
    for (const key of [
      'text',
      'font',
      'size',
      'color',
      'align',
      'uppercase',
      'wrapWidth',
      'strokeWidth',
      'strokeColor',
      'shadow',
      'shadowBlur',
      'shadowOffsetX',
      'shadowOffsetY',
      'shadowColor',
      'opacity',
      'x',
      'y',
      'format',
    ]) {
      expect(keys).toContain(key);
    }
    const font = meta.options?.find((o) => o.key === 'font');
    expect(font && font.type === 'select' ? font.choices.map((c) => c.value) : []).toEqual(
      Object.keys(FONT_STACKS),
    );
  });

  it('ships examples that the tool accepts', () => {
    expect(meta.examples?.length).toBeGreaterThan(0);
    for (const example of meta.examples ?? []) {
      expect(() => readTextOptions(resolveOptions(meta, example.options))).not.toThrow();
    }
  });
});

describe('image-add-text run', () => {
  const run = (files: File[], options: Record<string, unknown> = {}, extra = {}) =>
    tool.run({
      files,
      options: resolveOptions(meta, { text: 'Hi', ...options }),
      ...extra,
    });

  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects more than one file', async () => {
    mock = installImageMock({ textWidth });
    await expect(run([makeFile('a.png'), makeFile('b.png')])).rejects.toThrow(
      /exactly one image file/i,
    );
  });

  it('rejects a non-image file', async () => {
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' });
    await expect(run([file])).rejects.toThrow(/not an image/i);
  });

  it('rejects empty text before touching the image', async () => {
    mock = installImageMock({ textWidth });
    await expect(
      tool.run({ files: [makeFile('a.png')], options: { text: '   ' } }),
    ).rejects.toThrow(/Enter the text/i);
    expect(mock.canvases).toHaveLength(0);
  });

  it('rejects an unknown output format', async () => {
    mock = installImageMock({ textWidth });
    await expect(run([makeFile('a.png')], { format: 'gif' })).rejects.toThrow(
      /Unknown output format/i,
    );
  });

  it('reports a friendly error for undecodable bytes', async () => {
    mock = installImageMock({ failDecode: true });
    await expect(run([makeFile('bad.png')])).rejects.toThrow(/could not be decoded/i);
  });

  it('reports a friendly error when createImageBitmap is unavailable', async () => {
    await expect(run([makeFile('a.png')])).rejects.toThrow(/createImageBitmap/i);
  });

  it('rejects an oversized source image', async () => {
    mock = installImageMock({ width: 20_000, height: 20_000, textWidth });
    await expect(run([makeFile('huge.png')])).rejects.toThrow(/too large/i);
  });

  it('cancels when the signal is already aborted', async () => {
    mock = installImageMock({ textWidth });
    await expect(
      tool.run({
        files: [makeFile('a.png')],
        options: resolveOptions(meta, { text: 'Hi' }),
        signal: AbortSignal.abort(),
      }),
    ).rejects.toThrow(/cancelled/i);
  });

  it('draws the text over the image and encodes a PNG by default', async () => {
    mock = installImageMock({ width: 400, height: 200, textWidth });
    const result = await run([makeFile('photo.png')], { text: 'Hi' });
    expect(result.outputs[0]!.filename).toBe('photo-text.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');
    const canvas = mock.canvases[0]!;
    expect([canvas.width, canvas.height]).toEqual([400, 200]);
    expect(canvas.draws).toHaveLength(1);
    expect(canvas.draws[0]!.args.slice(1)).toEqual([0, 0]);
    expect(canvas.texts).toHaveLength(1);
    expect(canvas.texts[0]).toMatchObject({
      kind: 'fill',
      text: 'Hi',
      x: 200,
      y: 170,
      font: `16px ${FONT_STACKS.sans}`,
      align: 'center',
      style: '#ffffff',
      alpha: 1,
    });
    expect(canvas.encodes[0]!.type).toBe('image/png');
    expect(result.stats).toMatchObject({ lines: 1, 'font size': '16 px', position: '50% / 85%' });
  });

  it('requests EXIF orientation while decoding', async () => {
    mock = installImageMock({ width: 400, height: 200, textWidth });
    await run([makeFile('photo.jpg', 'image/jpeg')], { text: 'Hi' });
    expect(mock.bitmaps[0]!.options).toEqual({ imageOrientation: 'from-image' });
  });

  it('wraps long text into several drawn lines that all fit the maximum width', async () => {
    mock = installImageMock({ width: 400, height: 200, textWidth });
    await run([makeFile('a.png')], { text: 'aaaaaaaaaa bbbbbbbbbb cccccccccc', size: 5, wrapWidth: 30 });
    const texts = mock.canvases[0]!.texts;
    expect(texts.map((t) => t.text)).toEqual(['aaaaaaaaaa bbbbbbbbbb', 'cccccccccc']);
    // 30% of 400px = 120px per line at 10px font.
    for (const call of texts) expect(textWidth(call.text, 10)).toBeLessThanOrEqual(120);
  });

  it('hard-breaks a word longer than the maximum width instead of overflowing', async () => {
    mock = installImageMock({ width: 400, height: 200, textWidth });
    await run([makeFile('a.png')], { text: 'unbreakableword', size: 5, wrapWidth: 12 });
    const lines = mock.canvases[0]!.texts.map((t) => t.text);
    expect(lines.join('')).toBe('unbreakableword');
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(textWidth(line, 10)).toBeLessThanOrEqual(48);
  });

  it('honours the uppercase flag', async () => {
    mock = installImageMock({ width: 400, height: 200, textWidth });
    await run([makeFile('a.png')], { text: 'hello there', uppercase: true });
    expect(mock.canvases[0]!.texts[0]!.text).toBe('HELLO THERE');
  });

  it('honours the alignment option', async () => {
    mock = installImageMock({ width: 400, height: 200, textWidth });
    await run([makeFile('a.png')], { text: 'Hi', align: 'left', x: 0 });
    expect(mock.canvases[0]!.texts[0]).toMatchObject({ align: 'left', x: 0 });
  });

  it('honours the font option', async () => {
    mock = installImageMock({ width: 400, height: 200, textWidth });
    await run([makeFile('a.png')], { text: 'Hi', font: 'impact' });
    expect(mock.canvases[0]!.texts[0]!.font).toBe(`16px ${FONT_STACKS.impact}`);
  });

  it('honours the opacity option', async () => {
    mock = installImageMock({ width: 400, height: 200, textWidth });
    await run([makeFile('a.png')], { text: 'Hi', opacity: 40 });
    expect(mock.canvases[0]!.texts[0]!.alpha).toBeCloseTo(0.4, 10);
  });

  it('honours the outline options and draws no outline at width 0', async () => {
    mock = installImageMock({ width: 400, height: 200, textWidth });
    await run([makeFile('a.png')], { text: 'Hi', strokeWidth: 25, strokeColor: '#00ff00' });
    const texts = mock.canvases[0]!.texts;
    expect(texts.map((t) => t.kind)).toEqual(['stroke', 'fill']);
    // 25% of the 16px default font.
    expect(texts[0]).toMatchObject({ lineWidth: 4, style: '#00ff00', text: 'Hi' });

    mock.restore();
    mock = installImageMock({ width: 400, height: 200, textWidth });
    await run([makeFile('a.png')], { text: 'Hi', strokeWidth: 0 });
    expect(mock.canvases[0]!.texts.map((t) => t.kind)).toEqual(['fill']);
  });

  it('honours the shadow options and leaves shadows off by default', async () => {
    mock = installImageMock({ width: 400, height: 200, textWidth });
    await run([makeFile('a.png')], {
      text: 'Hi',
      shadow: true,
      shadowBlur: 9,
      shadowOffsetX: 4,
      shadowOffsetY: -3,
      shadowColor: '#11223380',
    });
    expect(mock.canvases[0]!.texts[0]!.shadow).toEqual({
      color: '#11223380',
      blur: 9,
      offsetX: 4,
      offsetY: -3,
    });

    mock.restore();
    mock = installImageMock({ width: 400, height: 200, textWidth });
    await run([makeFile('a.png')], { text: 'Hi' });
    expect(mock.canvases[0]!.texts[0]!.shadow).toEqual({
      color: 'transparent',
      blur: 0,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it('honours the position options and clamps them to the canvas', async () => {
    mock = installImageMock({ width: 400, height: 200, textWidth });
    await run([makeFile('a.png')], { text: 'Hi', align: 'right', x: 0, y: 0 });
    // Right-aligned block (16 × 19.2) pulled fully onto the canvas.
    expect(mock.canvases[0]!.texts[0]).toMatchObject({ x: 16, y: 9.6 });
  });

  it('writes JPEG output flattened onto white', async () => {
    mock = installImageMock({ width: 400, height: 200, textWidth });
    const result = await run([makeFile('photo.png')], { text: 'Hi', format: 'jpeg' });
    expect(result.outputs[0]!.filename).toBe('photo-text.jpg');
    expect(result.outputs[0]!.blob.type).toBe('image/jpeg');
    expect(mock.canvases[0]!.fills).toEqual([
      { x: 0, y: 0, w: 400, h: 200, style: '#ffffff' },
    ]);
  });

  it('writes WebP output without flattening', async () => {
    mock = installImageMock({ width: 400, height: 200, textWidth });
    const result = await run([makeFile('photo.png')], { text: 'Hi', format: 'webp' });
    expect(result.outputs[0]!.filename).toBe('photo-text.webp');
    expect(result.outputs[0]!.blob.type).toBe('image/webp');
    expect(mock.canvases[0]!.fills).toEqual([]);
  });

  it('closes the decoded bitmap when it is done', async () => {
    mock = installImageMock({ width: 400, height: 200, textWidth });
    await run([makeFile('a.png')], { text: 'Hi' });
    expect(mock.bitmaps[0]!.closed).toBe(true);
  });

  it('reports progress through to completion', async () => {
    mock = installImageMock({ width: 400, height: 200, textWidth });
    const onProgress = vi.fn();
    await run([makeFile('a.png')], { text: 'Hi' }, { onProgress });
    expect(onProgress).toHaveBeenCalledWith(0.05, 'Decoding the image');
    expect(onProgress).toHaveBeenLastCalledWith(1, 'Done');
  });
});
