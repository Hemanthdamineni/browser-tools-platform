/**
 * Markdown preview — the tool module plus every pure helper behind it.
 *
 * Nothing in this file touches the DOM, the network or the clock, so the
 * renderer, the sanitiser and the document builders can all be unit tested in
 * isolation:
 *
 *   - `renderMarkdown()`        Markdown → HTML (GFM, hard breaks, heading ids)
 *   - `sanitizeHtml()`          strips everything executable from untrusted markup
 *   - `buildExportDocument()`   a standalone, self-contained `.html` file
 *   - `buildPreviewDocument()`  the same document, hardened for the sandboxed iframe
 *   - `buildPrintFragment()`    the copy the browser's print dialog renders
 *   - `extractCodeFences()`     the language of every fenced code block
 *   - `applyCodeHighlighting()` swaps `<pre><code>` blocks for highlighted markup
 *
 * The syntax highlighter itself is *not* here: Shiki needs a browser and is
 * loaded lazily by the workbench (see `markdown-preview.highlight.ts`). The
 * highlighter is injected as a plain callback, which keeps this module pure
 * and the highlighting testable with a stub.
 *
 * Security
 * --------
 * Markdown allows raw HTML and `marked` does not sanitise it. Two independent
 * mechanisms keep that from becoming a problem:
 *
 *   1. The live preview is rendered inside an `<iframe sandbox>` without
 *      `allow-scripts` and without `allow-same-origin`, so injected script can
 *      never execute and can never reach the page around it. The preview
 *      document also carries a Content-Security-Policy that blocks every
 *      remote request.
 *   2. Every document that leaves the preview — the exported file, the copied
 *      HTML and the printed page — is passed through `sanitizeHtml` first.
 */
import type { TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { marked } from 'marked';
import { meta } from './markdown-preview.meta';

/* -------------------------------------------------------------------------- */
/*  Limits                                                                      */
/* -------------------------------------------------------------------------- */

/** Documents above this size are refused with a clear message. */
export const MAX_INPUT_CHARS = 200_000;

/* -------------------------------------------------------------------------- */
/*  Rendering                                                                   */
/* -------------------------------------------------------------------------- */

export interface RenderOptions {
  /** GitHub Flavored Markdown: tables, strikethrough, task lists, autolinks. */
  gfm: boolean;
  /** Treat every newline inside a paragraph as a hard break. */
  breaks: boolean;
  /** Give every heading a slugified `id`. */
  headerIds: boolean;
}

/** Reverse the escaping `marked` applies to code and to inline code. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Escape text for use in HTML content or in a double-quoted attribute. */
export function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * A general HTML entity decoder, used for heading slugs and for the URL
 * scheme check. It understands numeric references and the handful of named
 * entities that can hide a scheme (`&colon;` is the classic one).
 *
 * `&amp;` is decoded last so that `&amp;lt;` stays `&lt;` instead of
 * collapsing into a raw `<`.
 */
function decodeHtmlEntities(text: string): string {
  let value = text;
  value = value.replace(/&#x([0-9a-f]+);?/gi, (_m, hex: string) => codePoint(parseInt(hex, 16)));
  value = value.replace(/&#(\d+);?/g, (_m, dec: string) => codePoint(parseInt(dec, 10)));
  value = value.replace(/&colon;/gi, ':');
  value = value.replace(/&tab;/gi, '\t');
  value = value.replace(/&newline;/gi, '\n');
  value = value.replace(/&lt;/gi, '<');
  value = value.replace(/&gt;/gi, '>');
  value = value.replace(/&quot;/gi, '"');
  value = value.replace(/&apos;/gi, "'");
  value = value.replace(/&nbsp;/gi, ' ');
  value = value.replace(/&amp;/gi, '&');
  return value;
}

function codePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/**
 * Remove the characters a browser ignores inside a URL: the C0 controls, the
 * space and the delete character. `java\tscript:` and `java script:` are the
 * same URL as `javascript:` once the noise is gone.
 */
function stripUrlNoise(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x20 || code === 0x7f) continue;
    out += char;
  }
  return out;
}

/** A heading slug: lowercase words joined by dashes, punctuation removed. */
export function headingSlug(text: string): string {
  return decodeHtmlEntities(text)
    .replace(/<[^>]*>/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * `marked` emits bare `<h1>…</h6>`; add slugged ids. Repeated headings get a
 * numeric suffix (`hello-world`, `hello-world-1`) so every id stays unique.
 */
function addHeadingIds(html: string): string {
  const seen = new Map<string, number>();
  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_match, level: string, inner: string) => {
    const base = headingSlug(inner);
    if (!base) return `<h${level}>${inner}</h${level}>`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count > 0 ? `${base}-${count}` : base;
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
}

/**
 * The Markdown → HTML step of the preview.
 *
 * The options are passed per call instead of through `marked.setOptions()`:
 * the live editor renders on every keystroke and must never mutate the
 * configuration another tool relies on.
 */
export function renderMarkdown(text: string, options: RenderOptions): string {
  const html = marked.parse(text ?? '', {
    gfm: options.gfm,
    breaks: options.breaks,
  }) as string;
  const withIds = options.headerIds ? addHeadingIds(html) : html;
  return withIds.replace(/\n+$/, '');
}

/* -------------------------------------------------------------------------- */
/*  Code blocks                                                                 */
/* -------------------------------------------------------------------------- */

export interface CodeBlock {
  /** The fence's language hint, lower-cased. Empty when the fence had none. */
  language: string;
  /** The code itself, with the HTML entities `marked` added decoded again. */
  code: string;
}

export interface CodeFence {
  /** The info string's first word, lower-cased. Empty when the fence had none. */
  language: string;
  /** The fence body, without the fence markers. */
  code: string;
}

/**
 * `marked` emits fenced code as `<pre><code class="language-x">…</code></pre>`
 * (or `<pre><code>…</code></pre>` when the fence carries no language). The
 * code itself is HTML-escaped, so it can never contain a literal `</code>`.
 */
const CODE_BLOCK_RE = /<pre><code(?: class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g;

/** Every fenced code block in a rendered Markdown fragment. */
export function extractCodeBlocks(html: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  for (const match of html.matchAll(CODE_BLOCK_RE)) {
    blocks.push({
      language: (match[1] ?? '').toLowerCase(),
      code: decodeEntities(match[2] ?? ''),
    });
  }
  return blocks;
}

/**
 * Replace every fenced code block in a rendered fragment. The callback gets the
 * block and its index; whatever it returns replaces the block verbatim.
 */
export function replaceCodeBlocks(
  html: string,
  replace: (block: CodeBlock, index: number) => string,
): string {
  let index = 0;
  return html.replace(
    CODE_BLOCK_RE,
    (_match, lang: string | undefined, code: string | undefined) => {
      const block: CodeBlock = {
        language: (lang ?? '').toLowerCase(),
        code: decodeEntities(code ?? ''),
      };
      const out = replace(block, index);
      index += 1;
      return out;
    },
  );
}

/** The unhighlighted rendering of a code block — also the fallback. */
export function plainCodeBlock(block: CodeBlock): string {
  const cls = block.language ? ` class="language-${escapeHtmlText(block.language)}"` : '';
  return `<pre><code${cls}>${escapeHtmlText(block.code)}</code></pre>`;
}

/**
 * Every fenced code block of a *Markdown source*, with the language it
 * declares. The panel uses this to know which highlighter chunks it has to
 * load before it renders the document.
 *
 * An unterminated fence swallows the rest of the document, exactly like
 * CommonMark says.
 */
export function extractCodeFences(markdown: string): CodeFence[] {
  const fences: CodeFence[] = [];
  let open: { marker: string; language: string; body: string[] } | null = null;

  for (const line of (markdown ?? '').split(/\r?\n/)) {
    const match = /^( {0,3})(`{3,}|~{3,})[ \t]*(.*)$/.exec(line);
    if (!match) {
      if (open) open.body.push(line);
      continue;
    }
    const marker = match[2]!;
    const info = (match[3] ?? '').trim();

    if (open) {
      const closes =
        marker[0] === open.marker[0] && marker.length >= open.marker.length && info === '';
      if (closes) {
        fences.push({ language: open.language, code: open.body.join('\n') });
        open = null;
      } else {
        open.body.push(line);
      }
      continue;
    }

    // A backtick fence may not have a backtick in its info string.
    if (marker[0] === '`' && info.includes('`')) continue;
    open = {
      marker,
      language: (info.split(/\s+/)[0] ?? '').toLowerCase(),
      body: [],
    };
  }

  if (open) fences.push({ language: open.language, code: open.body.join('\n') });
  return fences;
}

/**
 * Turns a code block into highlighted markup. Returning `null` (or throwing)
 * leaves the original `<pre><code>` block untouched.
 */
export type CodeHighlighter = (code: string, language: string) => string | null;

/**
 * Replace every code block of a rendered fragment with highlighted markup.
 * A highlighter that does not know the language — or that fails — leaves the
 * plain block in place, so a fence always renders.
 */
export function applyCodeHighlighting(html: string, highlight: CodeHighlighter): string {
  return html.replace(
    CODE_BLOCK_RE,
    (match, lang: string | undefined, code: string | undefined) => {
      const language = (lang ?? '').toLowerCase();
      // A fence without a language is not code the highlighter knows about.
      if (!language) return match;
      let out: string | null = null;
      try {
        out = highlight(decodeEntities(code ?? ''), language);
      } catch {
        out = null;
      }
      return typeof out === 'string' && out.trim() !== '' ? out : match;
    },
  );
}

/* -------------------------------------------------------------------------- */
/*  Document statistics                                                          */
/* -------------------------------------------------------------------------- */

export interface DocumentStats {
  characters: number;
  words: number;
  lines: number;
  headings: number;
  codeBlocks: number;
  links: number;
}

const FENCE_RE = /^\s{0,3}(?:`{3,}|~{3,})/gm;
const LINK_RE = /!?\[[^\]]*\]\([^)]*\)/g;

/** Cheap, dependency-free numbers about a Markdown document. */
export function documentStats(markdown: string): DocumentStats {
  const text = markdown ?? '';
  // A "word" is a chunk that carries at least one letter or digit — the
  // punctuation around it (`#`, `**`, `-`) is markup, not prose.
  const words = text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  const headings = (text.match(/^ {0,3}#{1,6}\s+\S.*$/gm) ?? []).length;
  const codeBlocks = (text.match(FENCE_RE) ?? []).length;
  const links = (text.match(LINK_RE) ?? []).length;
  return {
    characters: text.length,
    words,
    lines: text.length === 0 ? 0 : text.split('\n').length,
    headings,
    codeBlocks,
    links,
  };
}

/**
 * A title for the exported file: the first ATX heading, else the first
 * non-empty line, else the fallback.
 */
export function extractTitle(markdown: string, fallback = 'Markdown document'): string {
  const text = markdown ?? '';
  const heading = /^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/m.exec(text);
  if (heading?.[1]) return stripInlineMarkdown(heading[1]);
  const firstLine = text.split('\n').find((line) => line.trim().length > 0);
  if (firstLine) {
    const trimmed = stripInlineMarkdown(firstLine.trim());
    if (trimmed) return trimmed.length > 80 ? `${trimmed.slice(0, 79)}…` : trimmed;
  }
  return fallback;
}

/** Remove the inline Markdown syntax from a heading so it reads as a title. */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .trim();
}

/* -------------------------------------------------------------------------- */
/*  Sanitiser                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Elements that are removed together with everything inside them. For the
 * raw-text ones (`script`, `style`, `iframe`, …) the content is not markup at
 * all, so the scanner skips straight to the matching close tag.
 */
const DROP_WITH_CONTENT = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'applet',
  'frame',
  'frameset',
  'noscript',
  'template',
  'xmp',
  'noembed',
  'noframes',
  'plaintext',
]);

/** Raw-text elements: their content is text, so it is skipped verbatim. */
const RAW_TEXT_ELEMENTS = new Set([
  'script',
  'style',
  'iframe',
  'xmp',
  'noembed',
  'noframes',
  'plaintext',
]);

/** Elements dropped on their own — they can hijack the document around them. */
const DROP_ELEMENT = new Set(['base', 'link', 'meta', 'param']);

/** Elements whose tags go away but whose text content is kept. */
const UNWRAP_ELEMENT = new Set(['textarea', 'title']);

/** Attributes that carry a URL and therefore need a scheme check. */
const URL_ATTRIBUTES = new Set([
  'action',
  'archive',
  'background',
  'cite',
  'classid',
  'codebase',
  'data',
  'dynsrc',
  'formaction',
  'href',
  'icon',
  'longdesc',
  'lowsrc',
  'manifest',
  'ping',
  'poster',
  'profile',
  'src',
  'srcset',
  'usemap',
  'xlink:href',
]);

/** URL schemes a sanitised document may still link to. */
const SAFE_SCHEMES = new Set([
  'bitcoin',
  'callto',
  'ftp',
  'ftps',
  'geo',
  'http',
  'https',
  'irc',
  'ircs',
  'mailto',
  'magnet',
  'matrix',
  'news',
  'nntp',
  'sms',
  'tel',
  'tg',
  'webcal',
  'xmpp',
]);

/** CSS constructs that can execute code or load a remote resource. */
const DANGEROUS_CSS =
  /(expression\s*\(|javascript\s*:|vbscript\s*:|behaviou?r\s*:|-moz-binding|url\s*\(\s*['"]?\s*(?:javascript|vbscript|data\s*:\s*text\/html))/i;

interface ParsedAttribute {
  name: string;
  value: string | null;
}

interface ParsedTag {
  name: string;
  closing: boolean;
  selfClosing: boolean;
  attributes: ParsedAttribute[];
  /** Index just past the closing `>`. */
  end: number;
}

const TAG_NAME_RE = /^[a-zA-Z][a-zA-Z0-9:_-]*/;
const ATTR_NAME_RE = /^[^\s"'>/=]+/;
const UNQUOTED_VALUE_RE = /^[^\s>]*/;

function isSpace(code: number): boolean {
  return code === 32 || code === 9 || code === 10 || code === 12 || code === 13;
}

/** Parse the tag that starts at `start`; `null` when it is not a tag at all. */
function parseTag(html: string, start: number): ParsedTag | null {
  let i = start + 1;
  let closing = false;
  if (html[i] === '/') {
    closing = true;
    i += 1;
  }
  const nameMatch = TAG_NAME_RE.exec(html.slice(i));
  if (!nameMatch) return null;
  const name = nameMatch[0].toLowerCase();
  i += nameMatch[0].length;

  const attributes: ParsedAttribute[] = [];
  let selfClosing = false;

  while (i < html.length) {
    while (i < html.length && isSpace(html.charCodeAt(i))) i += 1;
    if (i >= html.length) break;
    const ch = html[i]!;
    if (ch === '>') {
      i += 1;
      break;
    }
    if (ch === '/') {
      if (html[i + 1] === '>') {
        selfClosing = true;
        i += 2;
        break;
      }
      i += 1;
      continue;
    }
    const attrMatch = ATTR_NAME_RE.exec(html.slice(i));
    if (!attrMatch) {
      i += 1;
      continue;
    }
    const attrName = attrMatch[0].toLowerCase();
    i += attrMatch[0].length;

    let value: string | null = null;
    let j = i;
    while (j < html.length && isSpace(html.charCodeAt(j))) j += 1;
    if (html[j] === '=') {
      j += 1;
      while (j < html.length && isSpace(html.charCodeAt(j))) j += 1;
      const quote = html[j];
      if (quote === '"' || quote === "'") {
        const end = html.indexOf(quote, j + 1);
        value = end === -1 ? html.slice(j + 1) : html.slice(j + 1, end);
        j = end === -1 ? html.length : end + 1;
      } else {
        const match = UNQUOTED_VALUE_RE.exec(html.slice(j))!;
        value = match[0];
        j += match[0].length;
      }
      i = j;
    }
    attributes.push({ name: attrName, value });
  }

  return { name, closing, selfClosing, attributes, end: i };
}

/** Skip past the close tag of a raw-text element. */
function skipRawText(html: string, from: number, name: string): number {
  const match = new RegExp(`</${name}\\b`, 'i').exec(html.slice(from));
  if (!match) return html.length;
  const end = html.indexOf('>', from + match.index);
  return end === -1 ? html.length : end + 1;
}

/**
 * True when a URL may stay in the sanitised output.
 *
 * `javascript:` and `data:` are never allowed: a `data:` URL can carry a whole
 * document, and an inline payload has no place in an exported file. Relative
 * URLs and the ordinary web schemes are kept.
 */
export function isSafeUrl(raw: string): boolean {
  const value = stripUrlNoise(decodeHtmlEntities(raw));
  if (!value) return true;
  if (value.startsWith('#')) return true;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  if (!scheme) return true; // a relative URL
  const name = scheme[1]!.toLowerCase();
  if (name === 'data' || name === 'javascript' || name === 'vbscript') return false;
  return SAFE_SCHEMES.has(name);
}

/** True when an attribute may stay in the sanitised output. */
function isSafeAttribute(attribute: ParsedAttribute): boolean {
  const name = attribute.name;
  // Every `on*` attribute is an event handler.
  if (name.startsWith('on')) return false;
  if (name === 'style') {
    return attribute.value === null || !DANGEROUS_CSS.test(attribute.value);
  }
  if (URL_ATTRIBUTES.has(name)) {
    if (attribute.value === null) return true;
    return isSafeUrl(attribute.value);
  }
  return true;
}

/**
 * Re-serialise an attribute value. The `&` is deliberately left alone: the
 * value is kept exactly as it was written, so `&amp;` still means `&` and the
 * document is not double-encoded.
 */
function escapeAttributeValue(value: string): string {
  return value.replace(/"/g, '&quot;');
}

function renderTag(tag: ParsedTag): string {
  const parts: string[] = [];
  for (const attribute of tag.attributes) {
    if (!isSafeAttribute(attribute)) continue;
    parts.push(
      attribute.value === null
        ? attribute.name
        : `${attribute.name}="${escapeAttributeValue(attribute.value)}"`,
    );
  }
  return parts.length ? `<${tag.name} ${parts.join(' ')}>` : `<${tag.name}>`;
}

/**
 * Remove everything from an HTML fragment that could execute code or hijack
 * the page it is embedded in.
 *
 * Removed: `<script>`, `<iframe>`, `<object>`, `<embed>` (and their content),
 * `<style>`, `<base>`, `<link>`, `<meta>`, HTML comments, every `on*` event
 * handler attribute, and every `javascript:` or `data:` URL.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  const out: string[] = [];
  let i = 0;
  let dropTag: string | null = null;
  let dropDepth = 0;

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      if (!dropTag) out.push(html.slice(i));
      break;
    }
    if (lt > i && !dropTag) out.push(html.slice(i, lt));
    i = lt;

    // Comments can hide conditional markup — drop them.
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    // Doctypes, CDATA sections and processing instructions carry nothing useful.
    if (html.startsWith('<!', i) || html.startsWith('<?', i)) {
      const end = html.indexOf('>', i);
      i = end === -1 ? html.length : end + 1;
      continue;
    }

    const tag = parseTag(html, i);
    if (!tag) {
      // A `<` that does not open a tag is literal text.
      if (!dropTag) out.push('&lt;');
      i += 1;
      continue;
    }
    i = tag.end;

    if (dropTag) {
      // Inside a dropped element: only its own close tag ends the region.
      if (tag.name === dropTag) {
        if (tag.closing) {
          if (dropDepth === 0) dropTag = null;
          else dropDepth -= 1;
        } else if (!tag.selfClosing) {
          dropDepth += 1;
        }
      }
      continue;
    }

    if (DROP_ELEMENT.has(tag.name)) continue;
    if (UNWRAP_ELEMENT.has(tag.name)) continue;

    if (DROP_WITH_CONTENT.has(tag.name)) {
      if (tag.closing) continue;
      if (RAW_TEXT_ELEMENTS.has(tag.name)) {
        i = skipRawText(html, i, tag.name);
        continue;
      }
      dropTag = tag.name;
      dropDepth = 0;
      continue;
    }

    if (tag.closing) {
      out.push(`</${tag.name}>`);
      continue;
    }
    out.push(renderTag(tag));
  }

  return out.join('');
}

/* -------------------------------------------------------------------------- */
/*  Documents                                                                    */
/* -------------------------------------------------------------------------- */

/** The colour variables of the rendered document. */
const LIGHT_VARIABLES = `
  --md-fg: #1f2328;
  --md-muted: #59636e;
  --md-border: #d0d7de;
  --md-bg: #ffffff;
  --md-inset: #f6f8fa;
  --md-accent: #0969da;
`;

const DARK_VARIABLES = `
  --md-fg: #e6edf3;
  --md-muted: #9198a1;
  --md-border: #3d444d;
  --md-bg: #0d1117;
  --md-inset: #161b22;
  --md-accent: #4493f8;
`;

/**
 * The stylesheet of a rendered document.
 *
 * `scope` is the element the rules apply to: `:root` for the standalone
 * documents, `.markdown-body` for the copy that is printed inside the page.
 * Scoping it that way keeps the print stylesheet from leaking into the site.
 */
export function documentStyles(scope: string): string {
  return `
${scope} {
${LIGHT_VARIABLES}
  color-scheme: light;
}
${scope}[data-theme='dark'] {
${DARK_VARIABLES}
  color-scheme: dark;
}
.markdown-body {
  max-width: 46rem;
  margin: 0 auto;
  color: var(--md-fg);
}
${scope} h1, ${scope} h2, ${scope} h3,
${scope} h4, ${scope} h5, ${scope} h6 {
  margin: 1.6em 0 0.6em;
  line-height: 1.25;
  font-weight: 600;
}
${scope} h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid var(--md-border); }
${scope} h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid var(--md-border); }
${scope} h3 { font-size: 1.25em; }
${scope} p, ${scope} ul, ${scope} ol { margin: 0 0 1em; }
${scope} ul, ${scope} ol { padding-left: 2em; }
${scope} li + li { margin-top: 0.25em; }
${scope} li > input[type='checkbox'] { margin: 0 0.35em 0 -1.4em; vertical-align: middle; }
${scope} li:has(> input[type='checkbox']) { list-style: none; }
${scope} a { color: var(--md-accent); text-decoration: none; }
${scope} a:hover { text-decoration: underline; }
${scope} blockquote {
  margin: 0 0 1em;
  padding: 0 1em;
  color: var(--md-muted);
  border-left: 0.25em solid var(--md-border);
}
${scope} code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.875em;
  background: var(--md-inset);
  padding: 0.2em 0.4em;
  border-radius: 6px;
}
${scope} pre {
  margin: 0 0 1em;
  padding: 1em;
  overflow: auto;
  background: var(--md-inset);
  border-radius: 6px;
}
${scope} pre code { padding: 0; background: none; font-size: 0.875em; }
${scope} table { border-collapse: collapse; margin: 0 0 1em; display: block; overflow: auto; }
${scope} th, ${scope} td { border: 1px solid var(--md-border); padding: 0.4em 0.85em; }
${scope} th { background: var(--md-inset); font-weight: 600; }
${scope} hr { height: 1px; border: 0; background: var(--md-border); margin: 1.5em 0; }
${scope} img { max-width: 100%; }
${scope} input[type='checkbox'] { margin-right: 0.35em; }
`;
}

/** The page-level rules of a standalone document. */
const PAGE_STYLES = `
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 2.5rem 1.25rem;
  background: var(--md-bg, #ffffff);
  color: var(--md-fg, #1f2328);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 16px;
  line-height: 1.65;
}
@media print {
  body { padding: 0; }
  pre, table { break-inside: avoid; }
}
`;

/**
 * The Content-Security-Policy of the exported file: no scripts, and no remote
 * request of any kind — the file has to work straight from the disk.
 */
export const EXPORT_CSP =
  "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

/**
 * The Content-Security-Policy of the live preview. It blocks every remote
 * request, so the preview can never phone home — the tool's promise of
 * `network: 'none'` has to hold for the preview too.
 */
export const PREVIEW_CSP =
  "default-src 'none'; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline'; font-src data:; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

export type PreviewTheme = 'light' | 'dark';

export interface ExportOptions {
  /** The document title. */
  title: string;
  /** The (already sanitised) body markup. */
  body: string;
  /** Light or dark. */
  theme?: PreviewTheme;
}

/** A standalone HTML file: the rendered document plus an embedded stylesheet. */
export function buildExportDocument(options: ExportOptions): string {
  const theme: PreviewTheme = options.theme === 'dark' ? 'dark' : 'light';
  const title = escapeHtmlText(options.title);
  return `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${EXPORT_CSP}">
<title>${title}</title>
<style>
${PAGE_STYLES}
${documentStyles(':root')}
</style>
</head>
<body>
<main class="markdown-body">
${options.body}
</main>
</body>
</html>
`;
}

/**
 * The document loaded into the sandboxed preview iframe. The strict
 * Content-Security-Policy keeps the preview offline: no remote stylesheet,
 * no remote image, no remote font, no script.
 */
export function buildPreviewDocument(body: string, theme: PreviewTheme = 'light'): string {
  return `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">
<title>Markdown preview</title>
<style>
${PAGE_STYLES}
${documentStyles(':root')}
</style>
</head>
<body>
<main class="markdown-body">
${body}
</main>
</body>
</html>
`;
}

/**
 * The fragment printed by the browser's own print dialog. It lives in the
 * page, so its stylesheet is scoped to `.markdown-body` and cannot leak into
 * the site around it.
 */
export function buildPrintFragment(body: string, theme: PreviewTheme = 'light'): string {
  return `<style>
${documentStyles('.markdown-body')}
</style>
<div class="markdown-body" data-theme="${theme}">
${body}
</div>`;
}

/* -------------------------------------------------------------------------- */
/*  The tool                                                                     */
/* -------------------------------------------------------------------------- */

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const text = input.text ?? '';

  if (text.length > MAX_INPUT_CHARS) {
    throw new ToolError(
      'Markdown input is too large.',
      `Keep it under ${MAX_INPUT_CHARS.toLocaleString('en-US')} characters.`,
    );
  }

  const gfm = Boolean(o.gfm);
  const breaks = Boolean(o.breaks);
  const headerIds = Boolean(o.headerIds);
  const html = renderMarkdown(text, { gfm, breaks, headerIds });
  // The output is filtered: the exported file, the copied HTML and the
  // printed page are all built from it, and all of them leave the sandbox.
  const safe = sanitizeHtml(html);
  const stats = documentStats(text);

  return {
    output: safe,
    render: 'code',
    language: 'html',
    stats: {
      'input chars': text.length,
      'output chars': safe.length,
      words: stats.words,
      headings: stats.headings,
      'code blocks': stats.codeBlocks,
      links: stats.links,
      gfm: gfm ? 'on' : 'off',
    },
    notes: [
      'The preview panel renders this HTML inside a sandboxed frame, so raw HTML in the document can never run scripts.',
      'The exported file is sanitised: scripts, frames, embedded objects, event-handler attributes and javascript:/data: URLs are removed.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
