import { ToolError } from '@/lib/types';

export interface CodeToImageOptions {
  language: string;
  theme: string;
  padding: number;
  background: 'theme' | 'transparent' | 'custom';
  customBackground: string;
  showChrome: boolean;
  title: string;
  format: 'svg' | 'png';
  scale: number;
  filename: string;
}

export const FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
export const FONT_SIZE = 14;
export const LINE_HEIGHT = 21; // FONT_SIZE * 1.5
export const CHAR_WIDTH = 8.4; // monospace advance ≈ 0.6 × font size
export const CHROME_HEIGHT = 44;

/** Built-in Shiki language ids exposed in the UI (plus 'auto'). */
export const LANGUAGE_CHOICES = [
  'auto',
  'typescript',
  'javascript',
  'python',
  'css',
  'html',
  'json',
  'yaml',
  'bash',
  'sql',
  'rust',
  'go',
  'java',
  'c',
  'cpp',
  'csharp',
  'php',
  'ruby',
  'markdown',
  'toml',
  'xml',
] as const;

/** Bundled Shiki themes (loaded locally, no network). */
export const THEME_CHOICES = [
  'github-dark',
  'github-light',
  'github-dark-dimmed',
  'one-dark-pro',
  'dracula',
  'nord',
  'catppuccin-mocha',
  'catppuccin-latte',
  'vitesse-dark',
  'vitesse-light',
  'tokyo-night',
  'rose-pine',
  'min-dark',
  'min-light',
] as const;

const EXTENSION_LANGUAGES: Record<string, string> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  py: 'python',
  pyw: 'python',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  vue: 'vue',
  svelte: 'svelte',
  json: 'json',
  jsonc: 'jsonc',
  json5: 'json5',
  yaml: 'yaml',
  yml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  sql: 'sql',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  rb: 'ruby',
  md: 'markdown',
  markdown: 'markdown',
  toml: 'toml',
  xml: 'xml',
  svg: 'xml',
  swift: 'swift',
  dart: 'dart',
};

/** XML-escape text destined for SVG markup. */
export function escapeXml(s: string): string {
  return s.replace(/[&<>'"]/g, (ch) => XML_ENTITIES[ch]!);
}

const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Guess a Shiki language id. Explicit choice wins; otherwise a filename
 * extension, then a light content sniff, then plain text.
 */
export function resolveLanguage(
  option: string,
  filename: string | undefined,
  code: string,
): string {
  if (option !== 'auto') return option;
  const ext = filename?.includes('.') ? filename.split('.').pop()!.toLowerCase() : undefined;
  if (ext && EXTENSION_LANGUAGES[ext]) return EXTENSION_LANGUAGES[ext]!;
  const trimmed = code.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(code);
      return 'json';
    } catch {
      /* not JSON */
    }
  }
  if (/^\s*(def |class |import \w+$|from \w+ import)/m.test(code)) return 'python';
  if (/(^|\n)\s*(package |func |var \w+ =|:=)/.test(code)) return 'go';
  if (/^\s*(function |const |let |var |=>|import .* from|export )/m.test(code)) return 'javascript';
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\b/im.test(code)) return 'sql';
  if (trimmed.startsWith('#!')) return 'bash';
  return 'text';
}

export interface Dimensions {
  width: number;
  height: number;
}

/** Outer image size for a code block: padding, chrome bar and content box. */
export function computeDimensions(
  lines: number,
  maxLineChars: number,
  padding: number,
  chrome: boolean,
): Dimensions {
  const contentWidth = Math.ceil(maxLineChars * CHAR_WIDTH);
  const width = Math.max(padding * 2 + contentWidth, chrome ? 420 : 0);
  const chromeH = chrome ? CHROME_HEIGHT : 0;
  const height = padding * 2 + chromeH + lines * LINE_HEIGHT;
  return { width, height: Math.max(height, 1) };
}

export interface HighlightedLine {
  segments: { text: string; color: string }[];
}

export interface HighlightResult {
  lines: HighlightedLine[];
  bg: string;
  fg: string;
}

/**
 * Minimal structural view of Shiki's grammar engine, so tests can stub it
 * without loading WASM.
 */
export interface ShikiLike {
  codeToTokens(
    code: string,
    options: { lang: string; theme: string },
  ): { bg: string; fg: string; tokens: { content: string; color: string }[][] };
}

function mergeSegments(line: { content: string; color: string }[]): HighlightedLine {
  const segments: { text: string; color: string }[] = [];
  for (const token of line) {
    const last = segments[segments.length - 1];
    if (last && last.color === token.color) last.text += token.content;
    else segments.push({ text: token.content, color: token.color });
  }
  return { segments };
}

/** Tokenise code with Shiki into per-line coloured segments. */
export async function highlight(
  shiki: ShikiLike,
  code: string,
  language: string,
  theme: string,
): Promise<HighlightResult> {
  let result: { bg: string; fg: string; tokens: { content: string; color: string }[][] };
  try {
    result = shiki.codeToTokens(code, { lang: language, theme });
  } catch {
    throw new ToolError(
      `Could not highlight this as "${language}".`,
      'Pick a different language from the dropdown.',
    );
  }
  return { bg: result.bg, fg: result.fg, lines: result.tokens.map(mergeSegments) };
}

/** Build the final SVG document (background, window chrome, highlighted code). */
export function buildImageSvg(
  highlighted: HighlightResult,
  opts: Pick<
    CodeToImageOptions,
    'padding' | 'background' | 'customBackground' | 'showChrome' | 'title'
  >,
): { svg: string; width: number; height: number } {
  const maxChars = Math.max(
    1,
    ...highlighted.lines.map((line) => line.segments.reduce((n, s) => n + s.text.length, 0)),
  );
  const { width, height } = computeDimensions(
    highlighted.lines.length,
    maxChars,
    opts.padding,
    opts.showChrome,
  );

  let bg: string | undefined;
  if (opts.background === 'theme') bg = highlighted.bg;
  else if (opts.background === 'custom') bg = opts.customBackground;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  );
  if (bg) parts.push(`<rect width="${width}" height="${height}" fill="${escapeXml(bg)}"/>`);

  const contentY = opts.padding + (opts.showChrome ? CHROME_HEIGHT : 0);

  if (opts.showChrome) {
    const barFill = bg ? 'rgba(128,128,128,0.15)' : 'rgba(128,128,128,0.2)';
    parts.push(`<rect width="${width}" height="${CHROME_HEIGHT}" fill="${barFill}"/>`);
    const light = isLightBackground(bg ?? '#ffffff');
    const dotColors = light ? ['#ff5f57', '#febc2e', '#28c840'] : ['#ff5f57', '#febc2e', '#28c840'];
    dotColors.forEach((color, i) => {
      const cx = opts.padding / 2 + 18 + i * 22;
      const cy = CHROME_HEIGHT / 2;
      parts.push(`<circle cx="${cx}" cy="${cy}" r="6" fill="${color}"/>`);
    });
    if (opts.title) {
      const titleColor = light ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)';
      parts.push(
        `<text x="${width / 2}" y="${CHROME_HEIGHT / 2 + 4}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="12" fill="${titleColor}">${escapeXml(opts.title)}</text>`,
      );
    }
  }

  const textFill = opts.background === 'transparent' ? 'currentColor' : highlighted.fg;
  highlighted.lines.forEach((line, i) => {
    if (!line.segments.length) return;
    const y = contentY + i * LINE_HEIGHT + FONT_SIZE;
    const tspans = line.segments
      .map((s) => `<tspan fill="${s.color}">${escapeXml(s.text)}</tspan>`)
      .join('');
    parts.push(
      `<text x="${opts.padding}" y="${y}" font-family="${FONT_FAMILY}" font-size="${FONT_SIZE}" fill="${textFill}" xml:space="preserve">${tspans}</text>`,
    );
  });

  parts.push('</svg>');
  return { svg: parts.join(''), width, height };
}

/** Heuristic: does a hex colour read as light? */
export function isLightBackground(color: string): boolean {
  const hex = color.replace('#', '');
  if (hex.length < 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return false;
  return 0.299 * r + 0.587 * g + 0.114 * b > 140;
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

/**
 * Rasterise an SVG string to PNG via canvas — fully local, no network fetch.
 * `size` comes from `buildImageSvg`.
 */
export async function rasteriseSvg(svg: string, size: Dimensions, scale: number): Promise<Blob> {
  const url = svgToDataUrl(svg);
  const image = new Image();
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  image.onload = () => resolve();
  image.onerror = () => reject(new ToolError('Could not rasterise the image.'));
  image.src = url;
  await promise;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(size.width * scale);
  canvas.height = Math.round(size.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ToolError('Canvas is not available in this browser.');
  ctx.scale(scale, scale);
  ctx.drawImage(image, 0, 0, size.width, size.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new ToolError('Could not encode the PNG.');
  return blob;
}

export function buildFilename(base: string, format: 'svg' | 'png'): string {
  const safe =
    base
      .trim()
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'code-to-image';
  return `${safe}.${format}`;
}
