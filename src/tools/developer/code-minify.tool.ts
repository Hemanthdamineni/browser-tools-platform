import type { OptionValues, TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { formatBytes, formatNumber, formatPercent } from '@/lib/format';
import { meta } from './code-minify.meta';

/**
 * Minify JavaScript (terser), CSS (csso) and HTML (html-minifier-terser).
 *
 * All three libraries are pulled in with `await import()` the first time the
 * matching language is used, so the page itself stays small and a CSS-only run
 * never downloads the JavaScript parser. Nothing is uploaded.
 */

type Language = 'js' | 'css' | 'html';

const LABELS: Record<Language, string> = { js: 'JavaScript', css: 'CSS', html: 'HTML' };
const CODE_LABELS: Record<Language, string> = { js: 'javascript', css: 'css', html: 'html' };
const EXTENSIONS: Record<Language, string> = { js: 'js', css: 'css', html: 'html' };

/** Generous, but keeps the main thread responsive while minifying. */
const MAX_INPUT = 1_000_000;

/* -------------------------------------------------------------------------- */
/*  Language detection (used only while the language option is "auto")        */
/* -------------------------------------------------------------------------- */

const HTML_ELEMENTS =
  /<(html|head|body|div|p|span|section|article|header|footer|main|nav|aside|ul|ol|li|table|thead|tbody|tr|td|th|a|button|form|label|select|option|textarea|h[1-6]|pre|code|blockquote|figure|figcaption|hr|br|img|input|meta|link|script|style|title|iframe|video|audio|source|picture|template|svg)\b/i;
const JS_KEYWORDS =
  /\b(const|let|var|function|class|return|import|export|async|await|new|typeof|require|console)\b/;
const JS_ONLY = new RegExp(`${JS_KEYWORDS.source}|=>`);
const CSS_AT_RULE =
  /^@(charset|import|namespace|media|supports|page|font-face|keyframes|layer|container|property|scope|document)\b/i;

function looksLikeHtml(source: string): boolean {
  if (/^<!doctype\s+html/i.test(source) || source.startsWith('<!--')) return true;
  if (!/<[a-z][\w-]*(\s[^<>]*)?\/?>/i.test(source)) return false;
  // A closing tag or a well-known element name is enough to call it HTML.
  return source.includes('</') || HTML_ELEMENTS.test(source);
}

function looksLikeCss(source: string): boolean {
  if (CSS_AT_RULE.test(source)) return true;
  const open = source.indexOf('{');
  if (open === -1 || !source.includes('}')) return false;
  // Constructs that only appear in JavaScript rule trim CSS out.
  if (JS_ONLY.test(source)) return false;
  if (source.slice(0, open).includes('=')) return false; // `const x = {`, `=> {`
  const blocks = source.match(/\{[^{}]*\}/g) ?? [];
  return blocks.some((block) => /[-a-z][\w-]*\s*:/.test(block.slice(1, -1)));
}

function looksLikeJs(source: string): boolean {
  return JS_ONLY.test(source) || /(^|\s)\/\//.test(source);
}

function detectLanguage(source: string, requested: string): Language {
  if (requested === 'js' || requested === 'css' || requested === 'html') return requested;
  if (looksLikeHtml(source)) return 'html';
  if (looksLikeCss(source)) return 'css';
  if (looksLikeJs(source)) return 'js';
  throw new ToolError(
    'Could not tell whether this is JavaScript, CSS or HTML.',
    'Pick the language in Options, or start the snippet with a tag, a selector, or a JavaScript keyword.',
  );
}

/* -------------------------------------------------------------------------- */
/*  Lazy minifier bundles                                                     */
/* -------------------------------------------------------------------------- */

type TerserModule = typeof import('terser');
type CssoModule = typeof import('csso');
type HtmlMinifierModule = typeof import('html-minifier-terser');

let terserModule: Promise<TerserModule> | undefined;
let cssoModule: Promise<CssoModule> | undefined;
let htmlMinifierModule: Promise<HtmlMinifierModule> | undefined;

function loadTerser(): Promise<TerserModule> {
  terserModule ??= import('terser');
  return terserModule;
}

function loadCsso(): Promise<CssoModule> {
  cssoModule ??= import('csso');
  return cssoModule;
}

function loadHtmlMinifier(): Promise<HtmlMinifierModule> {
  htmlMinifierModule ??= import('html-minifier-terser');
  return htmlMinifierModule;
}

function parserHint(error: unknown): string | undefined {
  if (error instanceof Error && error.message) return `The parser said: ${error.message}`;
  return undefined;
}

/* -------------------------------------------------------------------------- */
/*  Minification                                                              */
/* -------------------------------------------------------------------------- */

async function minifyJs(source: string, o: OptionValues): Promise<string> {
  const { minify } = await loadTerser();
  try {
    const result = await minify(source, {
      compress: Boolean(o.compress),
      mangle: Boolean(o.mangle),
      format: { comments: false },
    });
    if (typeof result.code !== 'string') {
      throw new ToolError('This JavaScript could not be minified.');
    }
    // A snippet that is only comments legitimately minifies to nothing.
    return result.code;
  } catch (error) {
    if (error instanceof ToolError) throw error;
    throw new ToolError(
      'This JavaScript could not be parsed.',
      parserHint(error) ?? 'Check for a missing bracket, quote or semicolon.',
    );
  }
}

async function minifyCss(source: string, o: OptionValues): Promise<string> {
  const { minify } = await loadCsso();
  let css: string;
  try {
    css = minify(source, { restructure: Boolean(o.restructure) }).css;
  } catch (error) {
    throw new ToolError(
      'This CSS could not be parsed.',
      parserHint(error) ?? 'Check that every rule has a selector and `property: value;` pairs.',
    );
  }
  // csso drops anything it cannot parse, so an empty result from a source that
  // has real content means the input was not valid CSS.
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  if (!css && withoutComments) {
    throw new ToolError(
      'This CSS could not be parsed.',
      'Check that every rule has a selector and `property: value;` pairs.',
    );
  }
  return css;
}

async function minifyHtml(source: string, o: OptionValues): Promise<string> {
  const { minify } = await loadHtmlMinifier();
  let html: string;
  try {
    html = await minify(source, {
      collapseWhitespace: Boolean(o.collapseWhitespace),
      removeComments: Boolean(o.removeComments),
    });
  } catch (error) {
    throw new ToolError(
      'This HTML could not be parsed.',
      parserHint(error) ?? 'Check for unclosed tags, attribute quotes or comments.',
    );
  }
  if (!html && source.trim()) {
    throw new ToolError(
      'This HTML could not be parsed.',
      'Check for unclosed tags, attribute quotes or comments.',
    );
  }
  return html;
}

function minifyText(source: string, language: Language, o: OptionValues): Promise<string> {
  if (language === 'js') return minifyJs(source, o);
  if (language === 'css') return minifyCss(source, o);
  return minifyHtml(source, o);
}

/* -------------------------------------------------------------------------- */
/*  Result                                                                    */
/* -------------------------------------------------------------------------- */

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function savingsNote(inputBytes: number, saved: number): string {
  if (saved > 0) {
    return `Saved ${formatBytes(saved)} — from ${formatBytes(inputBytes)} to ${formatBytes(inputBytes - saved)}.`;
  }
  if (saved === 0) return 'No change — this snippet was already as small as it gets.';
  return `This snippet grew by ${formatBytes(-saved)}; there was little whitespace or dead code to remove.`;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const source = input.text ?? '';
  if (!source.trim()) return { output: '' };

  if (source.length > MAX_INPUT) {
    throw new ToolError(
      'This snippet is too large to minify here.',
      `Keep it under ${formatNumber(MAX_INPUT)} characters.`,
    );
  }

  const requested = String(o.language);
  const language = detectLanguage(source, requested);

  // The minifier for the chosen language is a separate bundle fetched on first
  // use. Report the wait so the first run does not look like a freeze.
  input.onProgress?.(0, 'Loading minifier…');
  const output = await minifyText(source, language, o);
  input.onProgress?.(1, 'Done');

  const inputBytes = byteLength(source);
  const outputBytes = byteLength(output);
  const saved = inputBytes - outputBytes;
  const fraction = inputBytes === 0 ? 0 : saved / inputBytes;

  const notes: string[] = [];
  if (requested === 'auto') notes.push(`Detected ${LABELS[language]} from the input.`);
  notes.push(savingsNote(inputBytes, saved));

  return {
    output,
    render: 'code',
    language: CODE_LABELS[language],
    filename: `minified.${EXTENSIONS[language]}`,
    stats: {
      language: LABELS[language],
      'input bytes': inputBytes,
      'output bytes': outputBytes,
      'bytes saved': saved,
      'percent saved': formatPercent(fraction),
    },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
