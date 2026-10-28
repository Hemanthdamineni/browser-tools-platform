/**
 * Pure logic for the signature maker.
 *
 * Nothing here touches the DOM: the stroke smoothing, the padded bounding box,
 * the typed-signature layout and the SVG serialisation are all plain maths and
 * string building, so they unit-test in Node and agree exactly with the panel
 * and with the headless tool run.
 *
 * The signature styles and font stacks are reused from the shared signature
 * module (`@/lib/signature`), the same module `pdf-sign` signs pages with, so
 * every signature source in the app renders the mark the same way.
 */
import { ToolError } from '@/lib/types';
import { signatureStyle } from '@/lib/signature/typed';
import { bytesToDataUrl } from '@/lib/signature/pixels';
import type { SignatureStyle } from '@/lib/signature/types';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

/** A 2D point in pad/backing-store space. */
export interface Point {
  x: number;
  y: number;
}

/** A whole signature: one or more ink strokes, each a polyline. */
export type Stroke = Point[];

/** The padded box a signature occupies. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Options for a drawn signature's SVG. */
export interface StrokeSvgOptions {
  /** Ink colour. Any CSS colour. */
  color?: string;
  /** Stroke width in viewBox units. */
  strokeWidth?: number;
  /** Quiet-zone padding around the ink, in viewBox units. */
  padding?: number;
}

/** Options for a typed signature's SVG. */
export interface TypedSvgOptions {
  /** Ink colour. Any CSS colour. */
  color?: string;
  /** One of the signature styles: script, classic, modern or mono. */
  style?: SignatureStyle | string;
  /** Font size in pixels — the layout follows it. */
  size?: number;
}

/** The measured layout of a typed name. */
export interface TypedLayout {
  /** The CSS font stack, already including the italic prefix when needed. */
  font: string;
  fontSize: number;
  /** Quiet-zone padding baked into the box. */
  padding: number;
  width: number;
  height: number;
  /** Where the text starts on the x axis. */
  textX: number;
  /** Where the text baseline sits on the y axis. */
  baseline: number;
}

/** Quiet-zone padding baked into a drawn signature's export. */
export const DEFAULT_PADDING = 24;

const PRECISION = 2;

const round = (n: number): number => {
  const f = 10 ** PRECISION;
  return Math.round(n * f) / f;
};

/* -------------------------------------------------------------------------- */
/*  Stroke smoothing                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Smooth a raw pointer sample sequence with Chaikin's corner-cutting
 * algorithm. Each pass replaces every inner corner with two points a quarter
 * of the way along its two edges, which rounds the polyline. One pass is
 * enough to take the jitter out of a finger or mouse trace; the endpoints are
 * kept so the stroke begins and ends where the user put it down and lifted it.
 */
export function smoothStroke(samples: Stroke, passes = 1): Stroke {
  if (samples.length < 3) return samples.map((p) => ({ x: p.x, y: p.y }));
  let polyline = samples.map((p) => ({ x: p.x, y: p.y }));
  const count = Math.max(0, Math.floor(passes));
  for (let pass = 0; pass < count; pass++) {
    const n = polyline.length;
    if (n < 3) break;
    const next: Point[] = [polyline[0]!];
    for (let i = 1; i < n; i++) {
      const a = polyline[i - 1]!;
      const b = polyline[i]!;
      next.push({ x: round(0.75 * a.x + 0.25 * b.x), y: round(0.75 * a.y + 0.25 * b.y) });
      next.push({ x: round(0.25 * a.x + 0.75 * b.x), y: round(0.25 * a.y + 0.75 * b.y) });
    }
    next.push(polyline[n - 1]!);
    polyline = next;
  }
  return polyline;
}

/* -------------------------------------------------------------------------- */
/*  Bounding box                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The bounding box of all ink, grown by `padding` on every side. Returns
 * `null` when there are no points at all.
 *
 * The box is geometric: for points spanning x ∈ [0, 20] with `padding = 10`
 * it is `{ x: -10, width: 40 }`, which is exactly what the SVG viewBox needs.
 */
export function signatureBounds(strokes: Stroke[], padding: number): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    for (const point of stroke) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
  }
  if (!Number.isFinite(minX)) return null;
  const pad = Math.max(0, Number(padding) || 0);
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

/* -------------------------------------------------------------------------- */
/*  SVG serialisation                                                          */
/* -------------------------------------------------------------------------- */

/** Escape text so it can sit inside XML character data or an attribute. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&#38;')
    .replace(/</g, '&#60;')
    .replace(/>/g, '&#62;')
    .replace(/"/g, '&#34;')
    .replace(/'/g, '&#39;');
}

/** Quote a CSS font stack so its commas stay inside the `font-family` value. */
function quotedFont(font: string): string {
  return `"${font.replace(/"/g, "'")}"`;
}

/** The path data for one stroke, shifted by `(-ox, -oy)` to sit at the origin. */
function strokePath(stroke: Stroke, ox: number, oy: number): string {
  // A single point is a tap: a zero-length segment plus `stroke-linecap="round"`
  // paints a dot.
  if (stroke.length === 1) {
    const only = stroke[0]!;
    const x = round(only.x - ox);
    const y = round(only.y - oy);
    return `M ${x} ${y} L ${x} ${y}`;
  }
  const parts: string[] = [];
  for (const point of stroke) {
    const command = parts.length === 0 ? 'M' : 'L';
    parts.push(`${command} ${round(point.x - ox)} ${round(point.y - oy)}`);
  }
  return parts.join(' ');
}

/**
 * Serialise drawn strokes into a transparent SVG. No background element is
 * emitted (so the export is transparent) and there are no external references.
 * Throws a {@link ToolError} when there is no ink to draw.
 */
export function strokesToSvg(strokes: Stroke[], options: StrokeSvgOptions = {}): string {
  const color = options.color || '#111827';
  const strokeWidth = Math.max(0.5, Number(options.strokeWidth) || 3);
  const padding = Number.isFinite(Number(options.padding))
    ? Math.max(0, Number(options.padding))
    : DEFAULT_PADDING;

  const bounds = signatureBounds(strokes, padding);
  if (!bounds) throw new ToolError('Draw a signature first.', 'The pad is empty.');

  const width = Math.max(1, round(bounds.width));
  const height = Math.max(1, round(bounds.height));
  const path = strokes
    .filter((stroke) => stroke.length > 0)
    .map((stroke) => strokePath(stroke, bounds.x, bounds.y))
    .join(' ');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<path d="${path}" fill="none" stroke="${color}" stroke-width="${round(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`
  );
}

/**
 * The layout of a typed name: the font stack, the font size and the box the
 * SVG needs. Mirrors the geometry of `renderTypedSignature` (the canvas
 * version `pdf-sign` uses), so the SVG and the PNG agree. Throws a
 * {@link ToolError} for a blank name.
 */
export function typedLayout(name: string, options: TypedSvgOptions = {}): TypedLayout {
  const text = String(name ?? '').trim();
  if (!text) throw new ToolError('Type a name first.', 'It cannot be blank.');
  const style = signatureStyle(options.style);
  const fontSize = Math.max(16, Math.min(512, Math.round(Number(options.size) || 180)));
  const padding = Math.ceil(fontSize * 0.3);
  // A fixed half-em advance per character approximates the canvas measurement
  // closely enough for the box; the SVG text is anchored, so it never clips the
  // name even if a glyph is a little wider.
  const advance = fontSize * 0.5;
  const width = Math.max(1, Math.ceil(text.length * advance) + padding * 2);
  const height = Math.max(1, Math.ceil(fontSize * 1.7) + padding * 2);
  return {
    font: `${style.italic ? 'italic ' : ''}${fontSize}px ${style.font}`,
    fontSize,
    padding,
    width,
    height,
    textX: padding,
    baseline: Math.round(height / 2),
  };
}

/**
 * Serialise a typed name into a transparent SVG. The background stays
 * transparent and there are no external references (the font is a system
 * stack from {@link signatureStyle}). Throws a {@link ToolError} for a blank
 * name.
 */
export function typedToSvg(name: string, options: TypedSvgOptions = {}): string {
  const layout = typedLayout(name, options);
  const color = options.color || '#111827';
  const italic = layout.font.startsWith('italic ') ? ' font-style="italic"' : '';
  const fontStack = layout.font.replace(/^(italic )?/, '').replace(/^\d+px /, '');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">` +
    `<text x="${layout.textX}" y="${layout.baseline}" fill="${color}" font-family="${quotedFont(fontStack)}" font-size="${layout.fontSize}"${italic} text-anchor="start" dominant-baseline="central">${escapeXml(String(name).trim())}</text>` +
    `</svg>`
  );
}

/** Encode an SVG string as a `data:image/svg+xml;base64` URL for rendering. */
export function svgDataUrl(svg: string): string {
  return bytesToDataUrl('image/svg+xml', new TextEncoder().encode(svg));
}

/**
 * Parse the tool's text payload (draw mode) into an array of strokes. Each
 * stroke is a list of `[x, y]` pairs. Throws a {@link ToolError} for anything
 * that is not that shape.
 */
export function parseStrokes(text: string): Stroke[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ToolError('That signature data is not valid JSON.', 'Export it again from the pad.');
  }
  if (!Array.isArray(raw)) {
    throw new ToolError('The signature data is not a list of strokes.');
  }
  const strokes: Stroke[] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry)) throw new ToolError('Each stroke must be a list of points.');
    const stroke: Point[] = [];
    for (const point of entry) {
      if (!Array.isArray(point) || point.length < 2) {
        throw new ToolError('Each point must have x and y coordinates.');
      }
      const x = Number(point[0]);
      const y = Number(point[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new ToolError('Point coordinates must be numbers.');
      }
      stroke.push({ x, y });
    }
    if (stroke.length > 0) strokes.push(stroke);
  }
  return strokes;
}
