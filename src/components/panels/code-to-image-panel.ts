/**
 * Code-to-image panel.
 *
 * Loaded on demand by `code-to-image.astro` so no Shiki code ships to pages
 * that do not turn snippets into images.
 *
 * The panel owns the browser APIs: it lazily loads Shiki from this origin (so
 * the grammar, the WebAssembly engine and the themes never leave the site),
 * highlights the snippet, lays it out and hands back an SVG string or a PNG
 * blob. Everything that is worth unit-testing lives in pure functions here so
 * it can run without a DOM or a WebAssembly runtime.
 */
import { clamp } from '@/lib/format';

/** Height of the window-chrome bar (traffic lights + title), in px. */
export const CHROME_HEIGHT = 38;

/** Advance of one monospace glyph as a fraction of the font size. */
export const MONO_ADVANCE = 0.6;

/** Monospace stack used in the generated image. */
export const MONO_FONT =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

/** The traffic-light colours, red → yellow → green. */
export const TRAFFIC_LIGHTS = ['#ff5f57', '#febc2e', '#28c840'];

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

/** One highlighted token as Shiki reports it. */
export interface TokenLike {
  content: string;
  color?: string;
  fontStyle?: number;
}

/** A logical line of tokens. */
export type TokenLineLike = TokenLike[];

/** A coloured text run that fits on one visual line. */
export interface Span {
  text: string;
  color: string;
  /** Shiki font-style flags: 1 = italic, 2 = bold, 3 = both. */
  fontStyle: number;
}

/** One visual (possibly wrapped) line of the code. */
export interface VisualLine {
  spans: Span[];
}

/** The settings that drive the layout, resolved from the form. */
export interface LayoutOptions {
  codeWidth: number;
  lineHeight: number;
  fontSize: number;
  padding: number;
  chrome: boolean;
}

/** The computed geometry of a highlighted snippet. */
export interface LayoutResult {
  visualLines: VisualLine[];
  /** Number of visual lines after wrapping (≥ the logical line count). */
  lineCount: number;
  /** `lineCount × lineHeight`. */
  codeHeight: number;
  /** Total image width, chrome not included. */
  imageWidth: number;
  /** Total image height, chrome + padding + code + padding. */
  imageHeight: number;
  /** The y offset where the code block starts (0 without chrome, `CHROME_HEIGHT` with). */
  contentTop: number;
}

/** The colours used by the rendered image. */
export interface ImageColors {
  fg: string;
  bg: string;
  /** Colour of the title text in the chrome bar (only used when chrome is on). */
  titleColor: string;
}

/* -------------------------------------------------------------------------- */
/*  Measurement                                                                */
/* -------------------------------------------------------------------------- */

/** Approximate rendered width of text in the monospace font, in px (tab = 2). */
export function measureText(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of Array.from(text)) w += (ch === '\t' ? 2 : 1) * MONO_ADVANCE * fontSize;
  return w;
}

/** Flatten a token line into spans, dropping empty tokens. */
export function lineToSpans(tokens: TokenLineLike): Span[] {
  const spans: Span[] = [];
  for (const token of tokens) {
    if (!token.content) continue;
    spans.push({ text: token.content, color: token.color ?? '', fontStyle: token.fontStyle ?? 0 });
  }
  return spans;
}

/**
 * Wrap a single logical line's spans so no visual line is wider than the code
 * box. A token may be split mid-way to honour the width; the split pieces keep
 * the token's colour locked to the FontStyle. An empty logical line still
 * yields one (empty) visual line so line spacing is preserved.
 */
export function wrapSpanLine(spans: Span[], codeWidth: number, fontSize: number): VisualLine[] {
  const out: VisualLine[] = [];
  let lineSpans: Span[] = [];
  let used = 0;

  for (const span of spans) {
    let rest = span.text;
    while (rest.length > 0) {
      const chars = Array.from(rest);
      let w = 0;
      let i = 0;
      for (; i < chars.length; i++) {
        const cw = (chars[i] === '\t' ? 2 : 1) * MONO_ADVANCE * fontSize;
        if (used + w + cw > codeWidth && used + w > 0) break;
        w += cw;
      }
      if (i === 0) i = 1; // a single char wider than the box still gets a line
      const piece = chars.slice(0, i).join('');
      lineSpans.push({ text: piece, color: span.color, fontStyle: span.fontStyle });
      used += w;
      rest = rest.slice(piece.length);
      // The line is full when the scan stopped before the end of the span —
      // i.e. the next glyph no longer fits — or when it has filled the box.
      // Testing `used >= codeWidth` alone misses the common case where the
      // accumulated glyph widths land a rounding hair below the integer width,
      // so a wrapped line would silently overflow the code box.
      if (i < chars.length || used >= codeWidth) {
        out.push({ spans: lineSpans });
        lineSpans = [];
        used = 0;
      }
    }
  }
  if (lineSpans.length) out.push({ spans: lineSpans });
  if (out.length === 0) out.push({ spans: [] });
  return out;
}

/**
 * Lay out every logical line into visual lines and compute the image geometry.
 * `imageHeight = chrome + padding + lineCount×lineHeight + padding`.
 */
export function layout(tokensLines: TokenLineLike[], opts: LayoutOptions): LayoutResult {
  const visualLines: VisualLine[] = [];
  for (const line of tokensLines) {
    const spans = lineToSpans(line);
    visualLines.push(...wrapSpanLine(spans, opts.codeWidth, opts.fontSize));
  }
  const lineCount = visualLines.length;
  const codeHeight = lineCount * opts.lineHeight;
  const contentTop = opts.chrome ? CHROME_HEIGHT : 0;
  const imageWidth = opts.codeWidth + 2 * opts.padding;
  const imageHeight = contentTop + opts.padding + codeHeight + opts.padding;
  return { visualLines, lineCount, codeHeight, imageWidth, imageHeight, contentTop };
}

/* -------------------------------------------------------------------------- */
/*  SVG serialisation                                                          */
/* -------------------------------------------------------------------------- */

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Font-style flags Shiki attaches to tokens. */
const STYLE_ITALIC = 1;
const STYLE_BOLD = 2;

/** SVG font-style/font-weight attributes for a token's fontStyle flags. */
function tokenFontAttrs(fontStyle: number): string {
  const parts: string[] = [];
  if (fontStyle & STYLE_BOLD) parts.push('font-weight="bold"');
  if (fontStyle & STYLE_ITALIC) parts.push('font-style="italic"');
  return parts.join(' ');
}

/**
 * Serialise a laid-out highlight to a self-contained SVG document. Every
 * attribute and text node is XML-escaped, and the colours come from the caller,
 * so the output is safe to embed as a `data:` URL or hand to a canvas.
 */
export function buildSvg(
  layout: LayoutResult,
  colors: ImageColors,
  opts: LayoutOptions,
  title: string,
): string {
  const { imageWidth, imageHeight, contentTop, visualLines, lineCount } = layout;
  const fontSize = opts.fontSize;
  const pad = opts.padding;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}" viewBox="0 0 ${imageWidth} ${imageHeight}" role="img">`,
  );
  parts.push(`<rect width="100%" height="100%" rx="8" fill="${xmlEscape(colors.bg)}"/>`);

  if (opts.chrome) {
    const cy = CHROME_HEIGHT / 2;
    TRAFFIC_LIGHTS.forEach((color, i) => {
      parts.push(`<circle cx="${pad + 12 + i * 16}" cy="${cy}" r="5.5" fill="${color}"/>`);
    });
    if (title) {
      parts.push(
        `<text x="${imageWidth / 2}" y="${cy + 4}" text-anchor="middle" font-family="${MONO_FONT}" font-size="12" fill="${xmlEscape(colors.titleColor)}">${xmlEscape(title)}</text>`,
      );
    }
  }

  const baseline = (i: number) =>
    contentTop + pad + (i + 1) * opts.lineHeight - (opts.lineHeight - fontSize) / 2;

  parts.push(
    `<g font-family="${MONO_FONT}" font-size="${fontSize}" fill="${xmlEscape(colors.fg)}">`,
  );
  for (let i = 0; i < lineCount; i++) {
    const line = visualLines[i]!;
    const y = baseline(i);
    if (line.spans.length === 0) {
      parts.push(`<text x="${pad}" y="${y}"></text>`);
      continue;
    }
    const tspans = line.spans
      .map((span) => {
        const fill = span.color ? ` fill="${xmlEscape(span.color)}"` : '';
        const font = span.fontStyle ? ` ${tokenFontAttrs(span.fontStyle)}` : '';
        return `<tspan${fill}${font}>${xmlEscape(span.text)}</tspan>`;
      })
      .join('');
    parts.push(`<text x="${pad}" y="${y}">${tspans}</text>`);
  }
  parts.push('</g>');
  parts.push('</svg>');
  return parts.join('');
}

/* -------------------------------------------------------------------------- */
/*  Settings                                                                   */
/* -------------------------------------------------------------------------- */

/** A resolved, clamped view of the whole option form. */
export interface CodeImageSettings {
  language: string;
  theme: string;
  chrome: boolean;
  title: string;
  padding: number;
  lineHeight: number;
  fontSize: number;
  codeWidth: number;
  background: string;
  format: 'png' | 'svg';
}

/** Round to an integer inside a range, falling back when the value is unusable. */
function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? clamp(Math.round(n), min, max) : fallback;
}

/** Clamp the raw form values into the settings the renderer uses. */
export function resolveSettings(raw: Record<string, unknown>): CodeImageSettings {
  const format = raw.format === 'svg' ? 'svg' : 'png';
  return {
    language: typeof raw.language === 'string' && raw.language ? raw.language : 'auto',
    theme: typeof raw.theme === 'string' && raw.theme ? raw.theme : 'github-dark',
    chrome: raw.windowChrome !== false && raw.windowChrome !== 'false',
    title: typeof raw.title === 'string' ? raw.title : '',
    padding: clampNumber(raw.padding, 16, 8, 64),
    lineHeight: clampNumber(raw.lineHeight, 24, 12, 48),
    fontSize: clampNumber(raw.fontSize, 14, 10, 24),
    codeWidth: clampNumber(raw.width, 680, 240, 1400),
    background: typeof raw.background === 'string' ? raw.background : 'theme',
    format,
  };
}

/** The layout half of the settings. */
export function layoutOptionsOf(settings: CodeImageSettings): LayoutOptions {
  return {
    codeWidth: settings.codeWidth,
    lineHeight: settings.lineHeight,
    fontSize: settings.fontSize,
    padding: settings.padding,
    chrome: settings.chrome,
  };
}

/** Resolve the background option: `theme` follows the highlight theme. */
export function resolveBackground(background: string, themeBg: string): string {
  const value = background.trim();
  return !value || value === 'theme' ? themeBg : value;
}

/** A readable title colour (near-black or near-white) for a hex background. */
export function readableColorFor(background: string, fallback: string): string {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(background.trim());
  if (!match) return fallback;
  let hex = match[1]!;
  if (hex.length === 3) hex = Array.from(hex, (c) => c + c).join('');
  else if (hex.length === 8) hex = hex.slice(0, 6);
  const channel = (offset: number) => parseInt(hex.slice(offset, offset + 2), 16) / 255;
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance =
    0.2126 * linear(channel(0)) + 0.7152 * linear(channel(2)) + 0.0722 * linear(channel(4));
  return luminance > 0.42 ? '#1f2430' : '#e6e6e6';
}

/** The `fg`/`bg`/`title` colours for one highlight theme. */
export function imageColorsFor(
  settings: CodeImageSettings,
  theme: { fg: string; bg: string },
): ImageColors {
  const bg = resolveBackground(settings.background, theme.bg);
  return { fg: theme.fg, bg, titleColor: readableColorFor(bg, theme.fg) };
}

/* -------------------------------------------------------------------------- */
/*  Shiki (loaded lazily from this origin)                                     */
/* -------------------------------------------------------------------------- */

/** The loaded Shiki core (grammar loader + tokeniser). */
interface HighlighterLike {
  loadLanguage(input: unknown): Promise<void>;
  loadTheme(input: unknown): Promise<void>;
  getTheme(name: string): { fg: string; bg: string };
  codeToTokens(
    code: string,
    options: { lang: string; theme: string },
  ): { tokens: TokenLineLike[]; fg: string; bg: string; themeName: string };
  dispose(): void;
}

let highlighterPromise: Promise<HighlighterLike> | undefined;

/**
 * Lazily build (and cache) the Shiki highlighter. The WebAssembly engine and
 * the grammars/themes are imported from this origin only when a highlight is
 * actually requested, so a page that never highlights ships none of it.
 */
export function getHighlighter(): Promise<HighlighterLike> {
  highlighterPromise ??= (async () => {
    const [{ createHighlighterCore }, { createOnigurumaEngine }, { wasmBinary }] =
      await Promise.all([
        import('shiki/core'),
        import('shiki/engine/oniguruma'),
        import('shiki/wasm'),
      ]);
    const engine = await createOnigurumaEngine(() => wasmBinary);
    const highlighter = await createHighlighterCore({ themes: [], langs: [], engine });
    return highlighter as unknown as HighlighterLike;
  })().catch((error: unknown) => {
    highlighterPromise = undefined;
    throw error;
  });
  return highlighterPromise;
}
