/**
 * Pure layout and drawing maths for the "Add Text to Image" tool.
 *
 * Nothing here touches the DOM: wrapping, block measurement, the drag ↔
 * percentage mapping and the drawing routine all work from a plain `measure`
 * function, so the module is unit-testable and can be shared by the Web Worker
 * tool (`image-add-text.tool.ts`) and the browser panel
 * (`image-add-text-panel.ts`) — the preview and the exported file therefore use
 * the exact same code path, only the canvas differs.
 */
import { ToolError } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Fonts                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Safe, locally-available font stacks. No web font is ever downloaded, so the
 * text renders identically offline and no request leaves the device.
 */
export const FONT_STACKS: Record<string, string> = {
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, 'Iowan Old Style', serif",
  mono: "ui-monospace, 'SF Mono', 'Cascadia Code', 'Liberation Mono', Consolas, Menlo, monospace",
  impact:
    "Impact, Haettenschweiler, 'Arial Black', 'Franklin Gothic Bold', 'Arial Narrow Bold', sans-serif",
};

/** Alignment values, in the order the option lists them. */
export const ALIGNMENTS = ['left', 'center', 'right'] as const;
export type Alignment = (typeof ALIGNMENTS)[number];

/** Block height between lines, as a multiple of the font size. */
export const LINE_HEIGHT_RATIO = 1.2;

/** A text block smaller than this is unreadable and never worth drawing. */
export const MIN_FONT_PX = 1;

/** Output formats the tool can encode. */
export const OUTPUT_FORMATS: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/* -------------------------------------------------------------------------- */
/*  Options                                                                    */
/* -------------------------------------------------------------------------- */

/** Fully resolved, validated caption options. */
export interface TextOptions {
  /** Text with CRLF normalised to LF; never empty. */
  text: string;
  /** Key into {@link FONT_STACKS}. */
  font: string;
  /** Font size as a percentage of the image's short edge. */
  size: number;
  color: string;
  align: Alignment;
  /** Outline width as a percentage of the font size (0 = no outline). */
  strokeWidth: number;
  strokeColor: string;
  shadow: boolean;
  /** Shadow blur / offsets in image pixels. */
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowColor: string;
  uppercase: boolean;
  /** Text opacity, 0–100. */
  opacity: number;
  /** Longest line, as a percentage of the image width. */
  wrapWidth: number;
  /** Anchor point, as a percentage of the image width/height. */
  x: number;
  y: number;
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTIONAL_COLOR = /^rgba?\(\s*[0-9.]+%?(?:\s*,\s*[0-9.]+%?){2,3}\s*\)$/i;

/**
 * Validate a user-supplied colour. Only forms the canvas understands verbatim
 * are accepted, so a typo fails loudly instead of silently falling back to
 * black.
 */
export function resolveColor(value: unknown, label: string): string {
  const raw = String(value ?? '').trim();
  if (raw.toLowerCase() === 'transparent') return 'transparent';
  if (HEX_COLOR.test(raw)) return raw.toLowerCase();
  if (FUNCTIONAL_COLOR.test(raw)) return raw;
  throw new ToolError(
    `Enter a valid ${label}.`,
    'Use a hex colour such as #ffffff, #00000080, or rgb(0, 0, 0).',
  );
}

/** Validate a font-stack key. */
export function resolveFont(value: unknown): string {
  const key = String(value ?? '').trim();
  if (!Object.hasOwn(FONT_STACKS, key)) {
    throw new ToolError(
      `Unknown font "${key || '(empty)'}".`,
      `Choose one of: ${Object.keys(FONT_STACKS).join(', ')}.`,
    );
  }
  return key;
}

/** Validate an alignment value. */
export function resolveAlignment(value: unknown): Alignment {
  const align = String(value ?? '').trim();
  if (!(ALIGNMENTS as readonly string[]).includes(align)) {
    throw new ToolError(
      `Unknown alignment "${align || '(empty)'}".`,
      `Choose one of: ${ALIGNMENTS.join(', ')}.`,
    );
  }
  return align as Alignment;
}

/** Validate a numeric option, rejecting blanks and out-of-range values. */
export function resolveNumber(value: unknown, label: string, min: number, max: number): number {
  if (typeof value === 'string' && value.trim() === '') {
    throw new ToolError(`Enter a number for the ${label}.`);
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) throw new ToolError(`Enter a number for the ${label}.`);
  if (num < min || num > max) {
    throw new ToolError(`The ${label} must be between ${min} and ${max}.`);
  }
  return num;
}

/**
 * Turn raw option values (straight from `resolveOptions()`) into validated
 * {@link TextOptions}. Every branch throws `ToolError` with a user-facing
 * message, so a bad option never reaches the canvas.
 */
export function readTextOptions(values: Record<string, unknown>): TextOptions {
  const text = String(values.text ?? '')
    .replace(/\r\n?/g, '\n')
    .trimEnd();
  if (text.trim() === '') {
    throw new ToolError(
      'Enter the text to draw on the image.',
      'Type a caption in the Text box, then drag it into place.',
    );
  }
  return {
    text,
    font: resolveFont(values.font ?? 'sans'),
    size: resolveNumber(values.size, 'font size', 0.5, 100),
    color: resolveColor(values.color ?? '#ffffff', 'text colour'),
    align: resolveAlignment(values.align ?? 'center'),
    strokeWidth: resolveNumber(values.strokeWidth, 'outline width', 0, 50),
    strokeColor: resolveColor(values.strokeColor ?? '#000000', 'outline colour'),
    shadow: values.shadow === true || values.shadow === 'true',
    shadowBlur: resolveNumber(values.shadowBlur, 'shadow blur', 0, 200),
    shadowOffsetX: resolveNumber(values.shadowOffsetX, 'shadow offset X', -200, 200),
    shadowOffsetY: resolveNumber(values.shadowOffsetY, 'shadow offset Y', -200, 200),
    shadowColor: resolveColor(values.shadowColor ?? '#000000b3', 'shadow colour'),
    uppercase: values.uppercase === true || values.uppercase === 'true',
    opacity: resolveNumber(values.opacity, 'opacity', 0, 100),
    wrapWidth: resolveNumber(values.wrapWidth, 'maximum line width', 5, 100),
    x: resolveNumber(values.x, 'horizontal position', 0, 100),
    y: resolveNumber(values.y, 'vertical position', 0, 100),
  };
}

/* -------------------------------------------------------------------------- */
/*  Wrapping                                                                   */
/* -------------------------------------------------------------------------- */

/** Measure one run of text at a given font size; `ctx.measureText` in practice. */
export type MeasureFn = (text: string, fontPx: number, fontStack: string) => number;

const segmenter: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/** Split into grapheme clusters so emoji and composed characters stay whole. */
export function splitGraphemes(text: string): string[] {
  if (!segmenter) return [...text];
  const out: string[] = [];
  for (const part of segmenter.segment(text)) out.push(part.segment);
  return out;
}

/**
 * A deterministic stand-in for `ctx.measureText`, used by callers (and tests)
 * that do not have a canvas: roughly 0.6em per code point.
 */
export function estimateMeasure(text: string, fontPx: number): number {
  return Math.round(text.length * fontPx * 0.6 * 100) / 100;
}

/**
 * Wrap `text` into lines no wider than `maxWidth` px.
 *
 * - existing line breaks are honoured (a blank paragraph becomes an empty line)
 * - whitespace-only input yields `['']`
 * - a single word wider than `maxWidth` is hard-broken between grapheme
 *   clusters, so text never overflows silently
 * - a cluster that alone exceeds `maxWidth` is emitted on its own line.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: MeasureFn,
  fontPx: number,
  fontStack: string,
): string[] {
  const measureOne = (line: string) => measure(line, fontPx, fontStack);
  if (!(maxWidth > 0)) throw new ToolError('The maximum line width must be greater than zero.');

  // Whitespace-only text has nothing to draw: one empty line, never a stack of
  // blank lines from every blank paragraph.
  if (text.trim() === '') return [''];

  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/u).filter((word) => word.length > 0);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let line = words[0]!;
    for (let i = 1; i < words.length; i++) {
      const word = words[i]!;
      const candidate = `${line} ${word}`;
      if (measureOne(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      lines.push(...hardBreak(line, maxWidth, measureOne));
      line = word;
    }
    lines.push(...hardBreak(line, maxWidth, measureOne));
  }
  return lines;
}

/** Break one whitespace-free run so every piece fits, if possible. */
function hardBreak(word: string, maxWidth: number, measureOne: (s: string) => number): string[] {
  if (measureOne(word) <= maxWidth) return [word];
  const lines: string[] = [];
  let buffer = '';
  let width = 0;
  for (const cluster of splitGraphemes(word)) {
    const clusterWidth = measureOne(cluster);
    if (buffer === '' || width + clusterWidth <= maxWidth) {
      buffer += cluster;
      width += clusterWidth;
      continue;
    }
    lines.push(buffer);
    buffer = cluster;
    width = clusterWidth;
  }
  if (buffer !== '') lines.push(buffer);
  return lines;
}

/* -------------------------------------------------------------------------- */
/*  Geometry                                                                   */
/* -------------------------------------------------------------------------- */

export interface Position {
  x: number;
  y: number;
}

export interface BlockBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value > max ? max : value;
}

/** Where a block of `width` × `height` sits when anchored at `x`/`y`. */
export function anchorBox(
  x: number,
  y: number,
  width: number,
  height: number,
  align: Alignment,
): BlockBox {
  const left = align === 'left' ? x : align === 'right' ? x - width : x - width / 2;
  return { left, top: y - height / 2, width, height };
}

/**
 * Clamp an anchor so the block stays fully inside a `canvasWidth` ×
 * `canvasHeight` image (alignment decides how the block sits around the
 * anchor, so the allowed range depends on the alignment).
 */
export function clampAnchor(
  x: number,
  y: number,
  width: number,
  height: number,
  align: Alignment,
  canvasWidth: number,
  canvasHeight: number,
): Position {
  // A block wider/taller than the canvas can only be centred in that axis.
  const [minX, maxX] =
    width >= canvasWidth
      ? [canvasWidth / 2, canvasWidth / 2]
      : align === 'left'
        ? [0, canvasWidth - width]
        : align === 'right'
          ? [width, canvasWidth]
          : [width / 2, canvasWidth - width / 2];
  const [minY, maxY] =
    height >= canvasHeight
      ? [canvasHeight / 2, canvasHeight / 2]
      : [height / 2, canvasHeight - height / 2];
  return { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) };
}

/** Pixel anchor → stored percentages of the image dimensions. */
export function toPercent(position: Position, canvasWidth: number, canvasHeight: number): Position {
  if (!(canvasWidth > 0) || !(canvasHeight > 0)) {
    throw new ToolError('The image has no drawable area.');
  }
  return {
    x: (position.x / canvasWidth) * 100,
    y: (position.y / canvasHeight) * 100,
  };
}

/** Stored percentages → pixel anchor (the inverse of {@link toPercent}). */
export function fromPercent(
  percent: Position,
  canvasWidth: number,
  canvasHeight: number,
): Position {
  return {
    x: (percent.x / 100) * canvasWidth,
    y: (percent.y / 100) * canvasHeight,
  };
}

/**
 * A drag over the preview → the anchor to store, in canvas pixels.
 *
 * `pointer` is the pointer position and `grab` is where inside the block the
 * drag started (where the user took hold of it), both in canvas pixels. The
 * alignment decides which point of the block the anchor is — its left edge, its
 * centre or its right edge — and the result is clamped to the canvas.
 */
export function dragToAnchor(
  pointer: Position,
  grab: Position,
  block: { width: number; height: number },
  align: Alignment,
  canvasWidth: number,
  canvasHeight: number,
): Position {
  const alignPad = align === 'left' ? 0 : align === 'right' ? block.width : block.width / 2;
  return clampAnchor(
    pointer.x - grab.x + alignPad,
    pointer.y - grab.y + block.height / 2,
    block.width,
    block.height,
    align,
    canvasWidth,
    canvasHeight,
  );
}

/**
 * Preview canvas size for an image, capped to `maxPixels` so a 50-megapixel
 * photo does not make the panel sluggish. Returns the scale factor between the
 * preview canvas and the real image.
 */
export function previewSize(
  width: number,
  height: number,
  maxPixels = 2_000_000,
): { width: number; height: number; scale: number } {
  if (!(width > 0) || !(height > 0)) {
    throw new ToolError('The image has no drawable area.');
  }
  const scale = width * height > maxPixels ? Math.sqrt(maxPixels / (width * height)) : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

/* -------------------------------------------------------------------------- */
/*  Plan + draw                                                                */
/* -------------------------------------------------------------------------- */

export interface CaptionPlan {
  /** CSS `font` shorthand. */
  font: string;
  fontPx: number;
  lineHeight: number;
  align: Alignment;
  lines: string[];
  /** Anchor in image pixels (the block sits around it per `align`). */
  x: number;
  y: number;
  box: BlockBox;
  color: string;
  /** 0–1. */
  opacity: number;
  /** Outline width in image pixels (0 = none). */
  strokeWidth: number;
  strokeColor: string;
  shadow: { blur: number; offsetX: number; offsetY: number; color: string } | null;
}

/** The slice of a 2D context {@link drawCaption} needs. */
export interface TextDrawContext {
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineJoin: CanvasLineJoin;
  miterLimit: number;
  globalAlpha: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  save(): void;
  restore(): void;
  measureText(text: string): { width: number };
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  strokeText(text: string, x: number, y: number, maxWidth?: number): void;
}

/**
 * Work out everything needed to draw the caption: wrapped lines, block box,
 * anchor and the resolved paint. Pure — it only uses `measure`.
 */
export function planCaption(
  measure: MeasureFn,
  options: TextOptions,
  canvasWidth: number,
  canvasHeight: number,
): CaptionPlan {
  if (!(canvasWidth > 0) || !(canvasHeight > 0)) {
    throw new ToolError('The image has no drawable area.');
  }
  const fontStack = FONT_STACKS[options.font]!;
  const fontPx = (options.size / 100) * Math.min(canvasWidth, canvasHeight);
  if (!(fontPx >= MIN_FONT_PX)) {
    throw new ToolError(
      `A ${options.size}% font is smaller than one pixel on this image.`,
      'Increase the size or use a larger image.',
    );
  }
  const maxWidth = (options.wrapWidth / 100) * canvasWidth;
  const text = options.uppercase ? options.text.toUpperCase() : options.text;
  const lines = wrapText(text, maxWidth, measure, fontPx, fontStack);
  const lineHeight = fontPx * LINE_HEIGHT_RATIO;
  let width = 0;
  for (const line of lines) width = Math.max(width, measure(line, fontPx, fontStack));
  const height = lines.length * lineHeight;
  const anchorPx = fromPercent({ x: options.x, y: options.y }, canvasWidth, canvasHeight);
  const anchor = clampAnchor(
    anchorPx.x,
    anchorPx.y,
    width,
    height,
    options.align,
    canvasWidth,
    canvasHeight,
  );
  return {
    font: `${fontPx}px ${fontStack}`,
    fontPx,
    lineHeight,
    align: options.align,
    lines,
    x: anchor.x,
    y: anchor.y,
    box: anchorBox(anchor.x, anchor.y, width, height, options.align),
    color: options.color,
    opacity: options.opacity / 100,
    strokeWidth: (options.strokeWidth / 100) * fontPx,
    strokeColor: options.strokeColor,
    shadow: options.shadow
      ? {
          blur: options.shadowBlur,
          offsetX: options.shadowOffsetX,
          offsetY: options.shadowOffsetY,
          color: options.shadowColor,
        }
      : null,
  };
}

function applyShadow(ctx: TextDrawContext, shadow: CaptionPlan['shadow']): void {
  ctx.shadowColor = shadow ? shadow.color : 'transparent';
  ctx.shadowBlur = shadow ? shadow.blur : 0;
  ctx.shadowOffsetX = shadow ? shadow.offsetX : 0;
  ctx.shadowOffsetY = shadow ? shadow.offsetY : 0;
}

/**
 * Draw a planned caption. Shared verbatim by the worker (final file) and the
 * panel (live preview), so what the user drags is exactly what is exported.
 *
 * The outline is drawn first, carrying the drop shadow, and the fill is drawn
 * on top without a shadow so the glyphs stay crisp.
 */
export function drawCaption(ctx: TextDrawContext, plan: CaptionPlan): void {
  ctx.save();
  try {
    ctx.font = plan.font;
    ctx.textAlign = plan.align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.globalAlpha = plan.opacity;
    const count = plan.lines.length;
    for (let i = 0; i < count; i++) {
      const line = plan.lines[i]!;
      if (line === '') continue;
      const baseline = plan.y + (i - (count - 1) / 2) * plan.lineHeight;
      if (plan.strokeWidth > 0) {
        ctx.lineWidth = plan.strokeWidth;
        ctx.strokeStyle = plan.strokeColor;
        applyShadow(ctx, plan.shadow);
        ctx.strokeText(line, plan.x, baseline);
        applyShadow(ctx, null);
      } else {
        applyShadow(ctx, plan.shadow);
      }
      ctx.fillStyle = plan.color;
      ctx.fillText(line, plan.x, baseline);
    }
  } finally {
    ctx.restore();
  }
}
