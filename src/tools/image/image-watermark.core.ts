/**
 * Pure layout + drawing maths for the image watermark tool.
 *
 * Every function here is a plain function of its arguments — no DOM, no canvas
 * factory, no randomness — so the same maths drives the worker, the live
 * preview and the unit tests. `computeLayout` turns image dimensions and option
 * values into the exact list of marks (centre, size, angle, alpha) a canvas
 * should paint; `drawWatermark` is the only canvas-aware function and only ever
 * calls standard 2D-context methods, so a live <canvas> preview and the
 * worker's `OffscreenCanvas` share one renderer.
 */
import type { OptionValues } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { parseHexColor } from './common';

/** How a watermark is produced. */
export type WatermarkMode = 'text' | 'logo';

/** The nine anchor points the watermark can sit at. */
export const WATERMARK_POSITIONS = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const;

export type WatermarkPosition = (typeof WATERMARK_POSITIONS)[number];

/** Ratio used to estimate a string width without a canvas (`measureText`). */
export const ESTIMATED_GLYPH_RATIO = 0.6;
/** One line of text occupies this multiple of the font size vertically. */
export const TEXT_LINE_RATIO = 1.2;
/** Refuse a tiling that would stamp more marks than this — a typo, not a wish. */
export const MAX_TILE_MARKS = 20_000;

/** Option values with every field validated and normalised. */
export interface WatermarkSettings {
  mode: WatermarkMode;
  text: string;
  /** Font size as a percentage of the image short edge. */
  fontSize: number;
  /** `rgb(...)` — safe to assign to `fillStyle`. */
  colorCss: string;
  /** Normalised 6-digit hex, for display in the panel. */
  colorHex: string;
  /** 0-100 as entered. */
  opacity: number;
  position: WatermarkPosition;
  /** Margin from the image edge, as a percentage of the short edge. */
  margin: number;
  tiled: boolean;
  /** Distance between tiles, as a percentage of the short edge. */
  tileSpacing: number;
  /** Rotation of every tile, in degrees. */
  tileAngle: number;
  /** Logo as a `data:image/...` URL. */
  logo: string;
  /** Logo width as a percentage of the image width. */
  logoScale: number;
}

export interface WatermarkMark {
  x: number;
  y: number;
}

export interface WatermarkLayout {
  /** Alpha (0-1) the marks are drawn with. */
  alpha: number;
  /** Rotation of every mark, in radians. */
  angle: number;
  /** One mark width in image pixels. */
  tileWidth: number;
  /** One mark height in image pixels. */
  tileHeight: number;
  /** Font size in pixels (text mode), 0 in logo mode. */
  fontPx: number;
  /** True when the mark repeats across the image. */
  tiled: boolean;
  /** Mark centres in image pixel space — exactly one entry when not tiled. */
  marks: WatermarkMark[];
}

export interface LayoutInput {
  settings: WatermarkSettings;
  imageWidth: number;
  imageHeight: number;
  /** Measured width of the whole text in px; estimated when omitted. */
  textWidth?: number;
  /** Logo source width in px (logo mode only). */
  logoWidth?: number;
  /** Logo source height in px (logo mode only). */
  logoHeight?: number;
}

/** Read a number that may arrive as a number or a DOM string, and range-check it. */
function numberIn(value: unknown, label: string, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (value === '' || value === null || value === undefined || !Number.isFinite(parsed)) {
    throw new ToolError(`${label} is not a number.`, 'Enter a value or move the slider.');
  }
  if (parsed < min || parsed > max) {
    throw new ToolError(`${label} must be between ${min} and ${max}.`);
  }
  return parsed;
}

/** Coerce a position option to one of the nine anchors. */
export function normalizePosition(value: unknown): WatermarkPosition {
  const raw = String(value ?? 'center');
  if ((WATERMARK_POSITIONS as readonly string[]).includes(raw)) return raw as WatermarkPosition;
  throw new ToolError(
    'Choose where the watermark sits.',
    'Pick one of the nine positions, from top-left to bottom-right.',
  );
}

/** Opacity as a 0-1 alpha. Out-of-range values are clamped, never propagated. */
export function clampOpacity(value: unknown): number {
  const percent = Number(value);
  if (!Number.isFinite(percent)) return 0;
  return Math.min(1, Math.max(0, percent / 100));
}

/** Validate every option and normalise it into {@link WatermarkSettings}. */
export function resolveWatermarkSettings(values: OptionValues): WatermarkSettings {
  const modeRaw = String(values.mode ?? 'text');
  if (modeRaw !== 'text' && modeRaw !== 'logo') {
    throw new ToolError('Choose a watermark type.', 'Stamp either text or a logo image.');
  }
  const opacity = numberIn(values.opacity, 'Opacity', 0, 100);
  const fontSize = numberIn(values.fontSize, 'Font size', 1, 100);
  const margin = numberIn(values.margin, 'Margin', 0, 50);
  const tileSpacing = numberIn(values.tileSpacing, 'Tile spacing', 1, 100);
  const tileAngle = numberIn(values.tileAngle, 'Tilt angle', -180, 180);
  const logoScale = numberIn(values.logoScale, 'Logo scale', 1, 100);
  const position = normalizePosition(values.position);
  const text = String(values.text ?? '');

  let colorCss = 'rgb(0, 0, 0)';
  let colorHex = '#000000';
  if (modeRaw === 'text') {
    if (!text.trim()) {
      throw new ToolError(
        'Enter the watermark text.',
        'Type the words you want stamped onto the image.',
      );
    }
    const rgb = parseHexColor(String(values.color ?? ''));
    if (!rgb) {
      throw new ToolError(
        'Enter a hex colour such as #000000.',
        'Use a 3- or 6-digit hex value, for example #ffffff.',
      );
    }
    colorHex = `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
    colorCss = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }

  const logo = String(values.logo ?? '');
  if (modeRaw === 'logo') {
    if (!logo.trim()) {
      throw new ToolError(
        'Choose a logo image.',
        'Pick a PNG, JPEG or SVG file to use as the watermark.',
      );
    }
    if (!/^data:image\//i.test(logo)) {
      throw new ToolError('The logo must be an image file.', 'Choose a PNG, JPEG or SVG file.');
    }
  }

  return {
    mode: modeRaw,
    text,
    fontSize,
    colorCss,
    colorHex,
    opacity,
    position,
    margin,
    tiled: values.tiled === true || String(values.tiled) === 'true',
    tileSpacing,
    tileAngle,
    logo,
    logoScale,
  };
}

/** Font size in pixels: the option is a percentage of the short edge. */
export function textFontPx(
  settings: WatermarkSettings,
  imageWidth: number,
  imageHeight: number,
): number {
  const shortEdge = Math.min(Math.max(1, imageWidth), Math.max(1, imageHeight));
  return (settings.fontSize / 100) * shortEdge;
}

/** CSS `font` shorthand used for both measuring and drawing the text. */
export function fontSpec(fontPx: number): string {
  return `bold ${Math.max(1, fontPx)}px sans-serif`;
}

/** Deterministic width estimate for a single line of text, with no canvas. */
export function estimateTextWidth(text: string, fontPx: number): number {
  return Math.max(1, [...text].length * fontPx * ESTIMATED_GLYPH_RATIO);
}

/** Half-extents of a tile box rotated by `angle` radians. */
export function rotatedHalfExtent(
  tileWidth: number,
  tileHeight: number,
  angle: number,
): { rx: number; ry: number } {
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  return {
    rx: (tileWidth / 2) * cos + (tileHeight / 2) * sin,
    ry: (tileWidth / 2) * sin + (tileHeight / 2) * cos,
  };
}

/**
 * Tile centres covering the whole image. The grid starts and ends one rotated
 * half-extent outside the canvas, so a rotated tile hanging over an edge still
 * covers the corner it would otherwise leave bare.
 */
export function tileMarks(
  imageWidth: number,
  imageHeight: number,
  spacing: number,
  angle: number,
  tileWidth: number,
  tileHeight: number,
): WatermarkMark[] {
  const step = Math.max(1, spacing);
  const { rx, ry } = rotatedHalfExtent(tileWidth, tileHeight, angle);
  const marks: WatermarkMark[] = [];
  for (let y = -ry; y <= imageHeight + ry; y += step) {
    for (let x = -rx; x <= imageWidth + rx; x += step) {
      if (marks.length >= MAX_TILE_MARKS) {
        throw new ToolError(
          'That tiling would stamp the watermark too many times.',
          'Increase the tile spacing, or use a smaller image.',
        );
      }
      marks.push({ x, y });
    }
  }
  return marks;
}

const LEFT_POSITIONS = new Set<string>(['top-left', 'middle-left', 'bottom-left']);
const RIGHT_POSITIONS = new Set<string>(['top-right', 'middle-right', 'bottom-right']);
const TOP_POSITIONS = new Set<string>(['top-left', 'top-center', 'top-right']);
const BOTTOM_POSITIONS = new Set<string>(['bottom-left', 'bottom-center', 'bottom-right']);

/** Horizontal centre of the mark for a position, margin included. */
export function anchorX(
  position: WatermarkPosition,
  imageWidth: number,
  tileWidth: number,
  margin: number,
): number {
  if (LEFT_POSITIONS.has(position)) return margin + tileWidth / 2;
  if (RIGHT_POSITIONS.has(position)) return imageWidth - margin - tileWidth / 2;
  return imageWidth / 2;
}

/** Vertical centre of the mark for a position, margin included. */
export function anchorY(
  position: WatermarkPosition,
  imageHeight: number,
  tileHeight: number,
  margin: number,
): number {
  if (TOP_POSITIONS.has(position)) return margin + tileHeight / 2;
  if (BOTTOM_POSITIONS.has(position)) return imageHeight - margin - tileHeight / 2;
  return imageHeight / 2;
}

/** Turn image dimensions and option values into the marks to paint. */
export function computeLayout(input: LayoutInput): WatermarkLayout {
  const settings = input.settings;
  const imageWidth = Math.max(1, Math.round(input.imageWidth));
  const imageHeight = Math.max(1, Math.round(input.imageHeight));
  const shortEdge = Math.min(imageWidth, imageHeight);
  const alpha = clampOpacity(settings.opacity);

  let tileWidth: number;
  let tileHeight: number;
  let fontPx = 0;
  if (settings.mode === 'text') {
    fontPx = textFontPx(settings, imageWidth, imageHeight);
    const measured = input.textWidth;
    tileWidth =
      measured !== undefined && Number.isFinite(measured) && measured > 0
        ? measured
        : estimateTextWidth(settings.text, fontPx);
    tileHeight = fontPx * TEXT_LINE_RATIO;
  } else {
    const logoWidth = Math.max(1, input.logoWidth ?? 1);
    const logoHeight = Math.max(1, input.logoHeight ?? 1);
    tileWidth = (settings.logoScale / 100) * imageWidth;
    tileHeight = tileWidth * (logoHeight / logoWidth);
  }

  if (!settings.tiled) {
    const margin = (settings.margin / 100) * shortEdge;
    return {
      alpha,
      angle: 0,
      tileWidth,
      tileHeight,
      fontPx,
      tiled: false,
      marks: [
        {
          x: anchorX(settings.position, imageWidth, tileWidth, margin),
          y: anchorY(settings.position, imageHeight, tileHeight, margin),
        },
      ],
    };
  }

  const spacing = Math.max(1, (settings.tileSpacing / 100) * shortEdge);
  const angle = (settings.tileAngle * Math.PI) / 180;
  return {
    alpha,
    angle,
    tileWidth,
    tileHeight,
    fontPx,
    tiled: true,
    marks: tileMarks(imageWidth, imageHeight, spacing, angle, tileWidth, tileHeight),
  };
}

/** The 2D-context slice {@link drawWatermark} uses — both canvas kinds satisfy it. */
export type WatermarkContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Paint every mark in {@link WatermarkLayout}. Only standard 2D-context calls
 * are used, so the same function renders the live preview and the worker output.
 */
export function drawWatermark(
  ctx: WatermarkContext,
  layout: WatermarkLayout,
  settings: WatermarkSettings,
  logo?: CanvasImageSource | null,
  signal?: AbortSignal,
): void {
  if (settings.mode === 'logo' && !logo) {
    throw new ToolError(
      'The logo image could not be prepared.',
      'Choose a different PNG, JPEG or SVG file.',
    );
  }
  ctx.globalAlpha = layout.alpha;
  if (settings.mode === 'text') {
    ctx.fillStyle = settings.colorCss;
    ctx.font = fontSpec(layout.fontPx);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  }
  let painted = 0;
  for (const mark of layout.marks) {
    // A huge tiling is the only place this loop can run long — let cancel win.
    if (painted % 256 === 0 && signal?.aborted) {
      throw new DOMException('The operation was cancelled.', 'AbortError');
    }
    painted += 1;
    ctx.save();
    ctx.translate(mark.x, mark.y);
    if (layout.angle !== 0) ctx.rotate(layout.angle);
    if (settings.mode === 'text') {
      ctx.fillText(settings.text, 0, 0);
    } else if (logo) {
      ctx.drawImage(
        logo,
        -layout.tileWidth / 2,
        -layout.tileHeight / 2,
        layout.tileWidth,
        layout.tileHeight,
      );
    }
    ctx.restore();
  }
}

/**
 * Decode a `data:` URL into a Blob without touching the network — the panel
 * hands the tool a logo as a data URL and this turns it back into bytes.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  if (comma < 0 || !/^data:/i.test(dataUrl)) {
    throw new ToolError('The logo is not a valid data URL.', 'Choose a PNG, JPEG or SVG file.');
  }
  const parts = dataUrl.slice(5, comma).split(';');
  const mime = parts[0] && parts[0] !== '' ? parts[0] : 'image/png';
  if (!mime.startsWith('image/')) {
    throw new ToolError('The logo must be an image file.', 'Choose a PNG, JPEG or SVG file.');
  }
  const body = dataUrl.slice(comma + 1);
  let text: string;
  if (parts.some((part) => part.toLowerCase() === 'base64')) {
    try {
      text = atob(body);
    } catch {
      throw new ToolError(
        'The logo image could not be read.',
        'Try a different PNG, JPEG or SVG file.',
      );
    }
  } else {
    try {
      text = decodeURIComponent(body);
    } catch {
      text = body;
    }
  }
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: mime });
}
