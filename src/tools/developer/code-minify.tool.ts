import type { OptionValues, TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './code-minify.meta';

/* -------------------------------------------------------------------------- */
/*  Formats                                                                   */
/* -------------------------------------------------------------------------- */

/** Every language the tool can minify. */
export const MINIFY_FORMATS = ['javascript', 'typescript', 'css', 'html', 'json'] as const;
export type MinifyFormat = (typeof MINIFY_FORMATS)[number];

/** How hard the minifier tries. */
export const MINIFY_PRESETS = ['safe', 'aggressive'] as const;
export type MinifyPreset = (typeof MINIFY_PRESETS)[number];

/** Label shown on the result and used as the `language` hint. */
const FORMAT_LABELS: Record<MinifyFormat, string> = {
  javascript: 'javascript',
  typescript: 'javascript',
  css: 'css',
  html: 'html',
  json: 'json',
};

/** Extension for the download filename. */
const FORMAT_EXTENSIONS: Record<MinifyFormat, string> = {
  javascript: 'js',
  typescript: 'ts',
  css: 'css',
  html: 'html',
  json: 'json',
};

/* -------------------------------------------------------------------------- */
/*  Option validation                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Normalise the `language` option. `auto` (or an unknown value) asks for
 * detection instead.
 */
export function resolveLanguageOption(value: unknown): MinifyFormat | 'auto' {
  if (value === 'auto') return 'auto';
  if (typeof value === 'string' && (MINIFY_FORMATS as readonly string[]).includes(value)) {
    return value as MinifyFormat;
  }
  return 'auto';
}

/** Normalise the `preset` option, falling back to the safe preset. */
export function resolvePresetOption(value: unknown): MinifyPreset {
  return value === 'aggressive' ? 'aggressive' : 'safe';
}

/** The download filename for a format. */
export function outputFilename(format: MinifyFormat): string {
  return `minified.${FORMAT_EXTENSIONS[format]}`;
}

/* -------------------------------------------------------------------------- */
/*  Detection                                                                 */
/* -------------------------------------------------------------------------- */

/** Words that only show up in JavaScript-ish source. */
const JS_HINT =
  /\b(?:const|let|var|function|class|return|import|export|new|typeof|instanceof|await|async|yield|delete|throw|try|catch|switch|case|default|extends|super|this)\b|=>|\+\+|--|\?\?|\?\./;

/** TypeScript-only syntax. */
const TS_HINT =
  /\b(?:interface|enum|namespace|declare|abstract|implements)\s+[A-Za-z_$]|\btype\s+[A-Za-z_$][\w$]*\s*(?:<[^>]*>)?\s*=|\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*:\s*(?:string|number|boolean|any|unknown|never|void|object|symbol|bigint|[A-Z][\w$]*)\b|\)\s*:\s*(?:string|number|boolean|void|any|unknown|never|Promise<[^>]+>|[A-Z][\w$]*)\s*(?:=>|\{)|\bas\s+(?:const|[A-Z][\w$]*)\b|\b(?:public|private|protected|readonly)\s+[A-Za-z_$]|\?\s*:\s*[A-Za-z_$]/;

function looksLikeTypeScript(source: string): boolean {
  return TS_HINT.test(source);
}

function looksLikeJavaScript(source: string): boolean {
  return JS_HINT.test(source);
}

function looksLikeCss(source: string): boolean {
  if (!/[{}]/.test(source)) return false;
  if (!/(^|[\s{};])[-a-zA-Z_][-\w]*\s*:\s*[^;{}]+/.test(source)) return false;
  return !looksLikeJavaScript(source);
}

function looksLikeHtml(source: string): boolean {
  return (
    /^<!doctype\s+html/i.test(source) ||
    /^<html[\s>]/i.test(source) ||
    /^<[a-z][\w-]*(?:\s[^<>]*)?>/i.test(source) ||
    /<\/(?:html|head|body|div|p|span|section|main|header|footer|ul|ol|table)>/i.test(source)
  );
}

/**
 * Guess the language of a snippet. Pure and synchronous — no minifier is
 * loaded to answer this.
 */
export function detectFormat(text: string): MinifyFormat {
  const source = text.trim();
  if (source === '') return 'javascript';

  // JSON is the one case where "does it parse?" is a definitive answer.
  if (/^[{[]/.test(source)) {
    try {
      JSON.parse(source);
      return 'json';
    } catch {
      /* not JSON — keep sniffing */
    }
  }

  if (looksLikeHtml(source)) return 'html';
  if (looksLikeTypeScript(source)) return 'typescript';
  if (looksLikeCss(source)) return 'css';
  if (looksLikeJavaScript(source)) return 'javascript';

  // Nothing matched: braces mean CSS, anything else is treated as JavaScript
  // so the minifier can report a real syntax error.
  return /[{}]/.test(source) ? 'css' : 'javascript';
}

/* -------------------------------------------------------------------------- */
/*  Savings                                                                   */
/* -------------------------------------------------------------------------- */

/** UTF-8 size of a string in bytes (not characters). */
export function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.codePointAt(i)!;
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code <= 0xffff) bytes += 3;
    else {
      bytes += 4;
      i++; // surrogate pair
    }
  }
  return bytes;
}

export interface Savings {
  inputBytes: number;
  outputBytes: number;
  savedBytes: number;
  /** Percentage saved, 0–100. */
  savedPercent: number;
}

/** How many bytes the minified output saved. */
export function computeSavings(input: string, output: string): Savings {
  const inputBytes = utf8Bytes(input);
  const outputBytes = utf8Bytes(output);
  const savedBytes = inputBytes - outputBytes;
  const savedPercent = inputBytes === 0 ? 0 : (savedBytes / inputBytes) * 100;
  return { inputBytes, outputBytes, savedBytes, savedPercent };
}

/* -------------------------------------------------------------------------- */
/*  HTML structure check                                                      */
/* -------------------------------------------------------------------------- */

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/** End tags the HTML spec lets you leave out, and what closes them. */
const OPTIONAL_END_TAGS: Record<string, Set<string>> = {
  p: new Set([
    'address',
    'article',
    'aside',
    'blockquote',
    'details',
    'div',
    'dl',
    'fieldset',
    'figcaption',
    'figure',
    'footer',
    'form',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'hgroup',
    'hr',
    'main',
    'menu',
    'nav',
    'ol',
    'p',
    'pre',
    'search',
    'section',
    'table',
    'ul',
  ]),
  li: new Set(['li']),
  dt: new Set(['dt', 'dd']),
  dd: new Set(['dt', 'dd']),
  option: new Set(['option', 'optgroup']),
  optgroup: new Set(['optgroup']),
  rt: new Set(['rt', 'rp']),
  rp: new Set(['rt', 'rp']),
  thead: new Set(['tbody', 'tfoot']),
  tbody: new Set(['tbody', 'tfoot']),
  tfoot: new Set(['tbody']),
  tr: new Set(['tr', 'tbody', 'tfoot', 'thead']),
  td: new Set(['td', 'th', 'tr', 'tbody', 'tfoot', 'thead']),
  th: new Set(['td', 'th', 'tr', 'tbody', 'tfoot', 'thead']),
};

/** End tags the spec closes implicitly when a parent end tag arrives. */
const IMPLIED_END_TAGS = new Set(['dd', 'dt', 'li', 'optgroup', 'option', 'p', 'rp', 'rt']);
const TABLE_END_TAGS = new Set(['td', 'th', 'tr']);

/** Index of the `>` that ends a tag, ignoring `>` inside quoted attributes. */
function findTagEnd(html: string, from: number): number {
  let quote: string | null = null;
  for (let i = from; i < html.length; i++) {
    const ch = html[i]!;
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '>') return i;
  }
  return -1;
}

/**
 * Check that the tags in an HTML fragment are balanced. Throws a `ToolError`
 * with a readable message for the usual mistakes.
 */
export function validateHtmlStructure(html: string): void {
  const stack: string[] = [];
  let i = 0;

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) break;
    i = lt + 1;

    // Comment
    if (html.startsWith('!--', i)) {
      const end = html.indexOf('-->', i + 3);
      if (end === -1) {
        throw new ToolError(
          'Unclosed HTML comment.',
          'Add the missing "-->" at the end of the comment.',
        );
      }
      i = end + 3;
      continue;
    }

    // Doctype, CDATA or processing instruction
    if (html[i] === '!' || html[i] === '?') {
      const gt = html.indexOf('>', i);
      if (gt === -1) {
        throw new ToolError(
          'Unclosed HTML declaration.',
          'Close it with a ">" — a doctype looks like <!doctype html>.',
        );
      }
      i = gt + 1;
      continue;
    }

    const closing = html.startsWith('/', i);
    if (closing) i += 1;

    const name = /^[A-Za-z][A-Za-z0-9:_-]*/.exec(html.slice(i))?.[0];
    if (!name) {
      // A stray "<" in text — not a tag.
      i = lt + 1;
      continue;
    }
    const tag = name.toLowerCase();
    i += name.length;

    const gt = findTagEnd(html, i);
    if (gt === -1) {
      throw new ToolError(
        `Unclosed <${tag}> tag.`,
        `Add a ">" to close the tag, or a closing </${tag}> if it is a block element.`,
      );
    }
    const selfClosing = html[gt - 1] === '/';
    i = gt + 1;

    if (closing) {
      // Close any element whose end tag the spec implies here.
      while (stack.length > 0) {
        const top = stack[stack.length - 1]!;
        if (top === tag) break;
        const implied =
          IMPLIED_END_TAGS.has(top) ||
          (TABLE_END_TAGS.has(top) && ['table', 'tbody', 'tfoot', 'thead'].includes(tag));
        if (!implied) break;
        stack.pop();
      }
      const top = stack[stack.length - 1];
      if (top === undefined) {
        throw new ToolError(
          `Unexpected closing tag </${tag}>.`,
          'There is no matching open tag. Remove the closing tag or open the element first.',
        );
      }
      if (top !== tag) {
        throw new ToolError(
          `Unexpected closing tag </${tag}>.`,
          `The <${top}> element is still open — close it with </${top}> first, or remove the </${tag}>.`,
        );
      }
      stack.pop();
      continue;
    }

    if (VOID_ELEMENTS.has(tag) || selfClosing) continue;

    // An opening tag can close an element whose end tag is optional.
    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      const closers = OPTIONAL_END_TAGS[top];
      if (!closers || !closers.has(tag)) break;
      stack.pop();
    }
    stack.push(tag);
  }

  // Anything left over is unclosed, unless its end tag was optional.
  while (stack.length > 0) {
    const top = stack[stack.length - 1]!;
    const optional =
      top in OPTIONAL_END_TAGS ||
      top === 'head' ||
      top === 'body' ||
      top === 'html' ||
      top === 'colgroup' ||
      top === 'tbody';
    if (!optional) break;
    stack.pop();
  }
  if (stack.length > 0) {
    const top = stack[stack.length - 1]!;
    throw new ToolError(
      `Unclosed <${top}> tag.`,
      `Add a closing </${top}> tag, or check for a missing ">" earlier in the document.`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  CSS structure check                                                       */
/* -------------------------------------------------------------------------- */

export interface CssProblem {
  message: string;
  hint: string;
}

/** Skip over a quoted string, returning the index just after it. */
function skipCssString(css: string, from: number): number {
  const quote = css[from]!;
  for (let i = from + 1; i < css.length; i++) {
    if (css[i] === '\\') {
      i++;
      continue;
    }
    if (css[i] === quote) return i + 1;
  }
  return css.length;
}

/** Skip over a balanced `(...)` group, returning the index just after it. */
function skipCssParens(css: string, from: number): number {
  let depth = 0;
  for (let i = from; i < css.length; i++) {
    const ch = css[i]!;
    if (ch === '"' || ch === "'") {
      i = skipCssString(css, i) - 1;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return css.length;
}

/**
 * Look for CSS the minifier cannot handle safely: nested selectors, empty
 * declaration values and unbalanced blocks.
 */
export function findCssProblems(css: string): CssProblem[] {
  const problems: CssProblem[] = [];
  let depth = 0;
  let i = 0;
  let chunkStart = 0;
  let chunkDepth = 0;

  const checkChunk = (chunk: string, insideBlock: boolean) => {
    if (!insideBlock) return;
    if (/^\s*[-a-zA-Z_][-\w]*\s*:\s*$/.test(chunk)) {
      problems.push({
        message: `This CSS has a declaration with no value (${chunk.trim()}).`,
        hint: 'Give the property a value, or delete the declaration.',
      });
    }
  };

  while (i < css.length) {
    const ch = css[i]!;

    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end === -1) {
        problems.push({
          message: 'Unclosed CSS comment.',
          hint: 'Add the missing "*/" at the end of the comment.',
        });
        break;
      }
      i = end + 2;
      continue;
    }

    if (ch === '"' || ch === "'") {
      i = skipCssString(css, i);
      continue;
    }

    if (ch === '(') {
      i = skipCssParens(css, i);
      continue;
    }

    if (ch === '&') {
      problems.push({
        message: 'This CSS uses nested selectors ("&"), which the minifier does not support.',
        hint: 'Flatten the nested rule by hand, or compile the CSS with a build tool first.',
      });
      i++;
      continue;
    }

    if (ch === '{') {
      checkChunk(css.slice(chunkStart, i), chunkDepth > 0);
      depth++;
      chunkDepth = depth;
      chunkStart = i + 1;
      i++;
      continue;
    }

    if (ch === '}') {
      checkChunk(css.slice(chunkStart, i), chunkDepth > 0);
      depth--;
      if (depth < 0) {
        problems.push({
          message: 'This CSS has an extra "}".',
          hint: 'Remove the unmatched closing brace.',
        });
        depth = 0;
      }
      chunkDepth = depth;
      chunkStart = i + 1;
      i++;
      continue;
    }

    if (ch === ';') {
      checkChunk(css.slice(chunkStart, i), chunkDepth > 0);
      chunkStart = i + 1;
      i++;
      continue;
    }

    i++;
  }

  if (depth > 0) {
    problems.push({
      message: 'This CSS has an unclosed block — a "{" is missing a "}".',
      hint: 'Check the last rule for a missing closing brace.',
    });
  }

  return problems;
}

/* -------------------------------------------------------------------------- */
/*  Lazy loading — every minifier is imported on first use only                */
/* -------------------------------------------------------------------------- */

type TerserModule = typeof import('terser');
type SucraseModule = typeof import('sucrase');
type CssoModule = typeof import('csso');
type HtmlMinifierModule = typeof import('html-minifier-terser');

let terserPromise: Promise<TerserModule> | null = null;
let sucrasePromise: Promise<SucraseModule> | null = null;
let cssoPromise: Promise<CssoModule> | null = null;
let htmlMinifierPromise: Promise<HtmlMinifierModule> | null = null;

function loadTerser(): Promise<TerserModule> {
  terserPromise ??= import('terser');
  return terserPromise;
}

function loadSucrase(): Promise<SucraseModule> {
  sucrasePromise ??= import('sucrase');
  return sucrasePromise;
}

function loadCsso(): Promise<CssoModule> {
  cssoPromise ??= import('csso');
  return cssoPromise;
}

function loadHtmlMinifier(): Promise<HtmlMinifierModule> {
  htmlMinifierPromise ??= import('html-minifier-terser');
  return htmlMinifierPromise;
}

/* -------------------------------------------------------------------------- */
/*  Minifiers                                                                 */
/* -------------------------------------------------------------------------- */

/** Terser's message, reduced to something a person can act on. */
function firstLine(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const line = raw.split('\n').find((part) => part.trim() !== '');
  return (line ?? raw).trim() || 'Could not minify this input.';
}

function terserOptions(preset: MinifyPreset): import('terser').MinifyOptions {
  if (preset === 'aggressive') {
    return {
      compress: { passes: 2, unsafe: true, unsafe_arrows: true, toplevel: true },
      mangle: { toplevel: true },
      toplevel: true,
    };
  }
  return {
    compress: { passes: 1 },
    mangle: false,
  };
}

/**
 * Terser loops forever on a stray `type X` / `interface X` statement when its
 * experimental TypeScript support is off, so the flag is switched on. Terser
 * builds that do not know the option are handled by the retry in `runTerser`.
 */
const TERSER_PARSE_OPTIONS = {
  experimental_typescript: true,
} as unknown as import('terser').ParseOptions;

async function runTerser(
  code: string,
  preset: MinifyPreset,
  parseOptions: import('terser').ParseOptions,
): Promise<string> {
  const terser = await loadTerser();
  let result: import('terser').MinifyOutput;
  try {
    result = await terser.minify(code, {
      ...terserOptions(preset),
      parse: parseOptions,
    });
  } catch (error) {
    if (parseOptions === TERSER_PARSE_OPTIONS && firstLine(error).includes('supported option')) {
      // The option was removed in this Terser build — try again without it.
      return runTerser(code, preset, {});
    }
    throw new ToolError(
      firstLine(error),
      'Check the syntax around the position above, or pick a different language under Options.',
    );
  }
  return result.code ?? '';
}

async function minifyJavaScript(code: string, preset: MinifyPreset): Promise<string> {
  return runTerser(code, preset, TERSER_PARSE_OPTIONS);
}

async function minifyTypeScript(code: string, preset: MinifyPreset): Promise<string> {
  const sucrase = await loadSucrase();
  let stripped: string;
  try {
    stripped = sucrase.transform(code, {
      transforms: ['typescript'],
      disableESTransforms: true,
    }).code;
  } catch (error) {
    throw new ToolError(
      firstLine(error),
      'Check the syntax around the position above, or pick a different language under Options.',
    );
  }
  return minifyJavaScript(stripped, preset);
}

async function minifyCss(code: string, preset: MinifyPreset): Promise<string> {
  const problems = findCssProblems(code);
  const first = problems[0];
  if (first) throw new ToolError(first.message, first.hint);

  const csso = await loadCsso();
  let output: string;
  try {
    output = csso.minify(code, { restructure: preset === 'aggressive' }).css;
  } catch (error) {
    throw new ToolError(firstLine(error), 'Check the CSS syntax around the position above.');
  }
  if (code.trim() !== '' && output.trim() === '') {
    throw new ToolError(
      'The CSS minifier could not compress this stylesheet.',
      'It probably uses a CSS feature the minifier does not support, such as nested rules.',
    );
  }
  return output;
}

async function minifyHtml(code: string, preset: MinifyPreset): Promise<string> {
  validateHtmlStructure(code);

  const htmlMinifier = await loadHtmlMinifier();
  const options: import('html-minifier-terser').Options = {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    minifyCSS: true,
    minifyJS: true,
    useShortDoctype: true,
  };
  if (preset === 'aggressive') {
    Object.assign(options, {
      removeOptionalTags: true,
      removeEmptyAttributes: true,
      collapseBooleanAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      removeAttributeQuotes: true,
    });
  }
  try {
    return await htmlMinifier.minify(code, options);
  } catch (error) {
    throw new ToolError(
      firstLine(error),
      'Check the HTML syntax, or pick a different language under Options.',
    );
  }
}

function minifyJson(code: string): string {
  let value: unknown;
  try {
    value = JSON.parse(code);
  } catch (error) {
    throw new ToolError(
      firstLine(error),
      'JSON has to be valid before it can be minified — check for a missing comma or quote.',
    );
  }
  return JSON.stringify(value);
}

/* -------------------------------------------------------------------------- */
/*  Run                                                                       */
/* -------------------------------------------------------------------------- */

type JavaScriptCheck =
  { kind: 'ok' } | { kind: 'typescript' } | { kind: 'invalid'; message: string };

/**
 * Check that the source parses as plain JavaScript. TypeScript is reported
 * separately so the tool can point at the right option instead of showing a
 * confusing syntax error.
 */
async function checkJavaScript(code: string): Promise<JavaScriptCheck> {
  const sucrase = await loadSucrase();
  try {
    sucrase.transform(code, { transforms: [], disableESTransforms: true });
    return { kind: 'ok' };
  } catch (error) {
    try {
      sucrase.transform(code, { transforms: ['typescript'], disableESTransforms: true });
      return { kind: 'typescript' };
    } catch {
      return { kind: 'invalid', message: firstLine(error) };
    }
  }
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o: OptionValues = resolveOptions(meta, input.options);
  const text = input.text ?? '';

  if (text.trim() === '') {
    return {
      output: '',
      render: 'code',
      language: 'text',
      filename: 'minified.txt',
      notes: ['Nothing to minify — the input is empty.'],
      stats: {
        'input bytes': 0,
        'output bytes': 0,
        'bytes saved': 0,
        'percent saved': '0%',
      },
    };
  }

  const preset = resolvePresetOption(o.preset);
  const selected = resolveLanguageOption(o.language);

  input.onProgress?.(0, 'Loading minifier…');

  let format: MinifyFormat = selected === 'auto' ? detectFormat(text) : selected;

  if (format === 'javascript') {
    const check = await checkJavaScript(text);
    if (check.kind === 'typescript') {
      if (selected !== 'auto') {
        throw new ToolError(
          'This looks like TypeScript, not JavaScript.',
          'Switch the Language option to TypeScript and run it again.',
        );
      }
      format = 'typescript';
    } else if (check.kind === 'invalid') {
      throw new ToolError(
        check.message,
        'Check the syntax around the position above, or pick a different language under Options.',
      );
    }
  }

  input.signal?.throwIfAborted?.();
  input.onProgress?.(0.5, 'Minifying…');

  let output: string;
  switch (format) {
    case 'typescript':
      output = await minifyTypeScript(text, preset);
      break;
    case 'javascript':
      output = await minifyJavaScript(text, preset);
      break;
    case 'css':
      output = await minifyCss(text, preset);
      break;
    case 'html':
      output = await minifyHtml(text, preset);
      break;
    case 'json':
      output = minifyJson(text);
      break;
  }

  const savings = computeSavings(text, output);
  const notes: string[] = [];
  if (preset === 'aggressive') {
    notes.push(
      'Aggressive mode can rename top-level identifiers and drop unused top-level code — check the output before shipping it.',
    );
  }
  if (format === 'json') {
    notes.push('JSON is always emitted as compact JSON; both presets produce the same result.');
  }
  if (format === 'typescript') {
    notes.push('TypeScript types are stripped — the output is plain JavaScript.');
  }

  return {
    output,
    render: 'code',
    language: FORMAT_LABELS[format],
    filename: outputFilename(format),
    notes: notes.length > 0 ? notes : undefined,
    stats: {
      language: FORMAT_LABELS[format],
      'input bytes': savings.inputBytes,
      'output bytes': savings.outputBytes,
      'bytes saved': savings.savedBytes,
      'percent saved': `${savings.savedPercent.toFixed(1)}%`,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
