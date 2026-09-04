import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './html-to-text.meta';

const MAX_INPUT = 500_000;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  shy: '',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  minus: '−',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  deg: '°',
  plusmn: '±',
  times: '×',
  divide: '÷',
  middot: '·',
  bull: '•',
  dagger: '†',
  Dagger: '‡',
  para: '¶',
  sect: '§',
  euro: '€',
  pound: '£',
  cent: '¢',
  yen: '¥',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  larr: '←',
  rarr: '→',
  uarr: '↑',
  darr: '↓',
  harr: '↔',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body.charCodeAt(0) === 35 /* '#' */) {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const num = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isFinite(num) || num < 0 || num > 0x10ffff) return match;
      try {
        return String.fromCodePoint(num);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[body];
    return named !== undefined ? named : match;
  });
}

function attr(tag: string, name: string): string {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i');
  const m = re.exec(tag);
  if (!m) return '';
  return (m[1] ?? m[2] ?? m[3] ?? '').trim();
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };
  if (input.text.length > MAX_INPUT) {
    throw new ToolError(
      'HTML input is too large.',
      `Keep it under ${MAX_INPUT.toLocaleString('en-US')} characters.`,
    );
  }

  const preserveLinks = Boolean(o.preserveLinks);
  const preserveImages = Boolean(o.preserveImages);

  let html = input.text;

  // 1. Comments.
  html = html.replace(/<!--[\s\S]*?-->/g, '');

  // 2. <script> / <style> including their contents.
  html = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  html = html.replace(/<\/?(?:script|style)\b[^>]*>/gi, '');

  // 3. Links -> "text (href)" when requested.
  if (preserveLinks) {
    html = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (whole, open: string, inner: string) => {
      const href = attr(`<a${open}>`, 'href');
      return href ? `${inner} (${href})` : (inner ?? whole);
    });
  }

  // 4. Images -> "[alt]" when requested, otherwise removed.
  html = html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (!preserveImages) return '';
    const alt = attr(tag, 'alt');
    return alt ? `[${alt}]` : '';
  });

  // 5. Structural whitespace.
  html = html.replace(/<br\s*\/?>/gi, '\n');
  html = html.replace(/<li\b[^>]*>/gi, '\n- ');
  html = html.replace(/<\/li\s*>/gi, '\n');
  html = html.replace(/<tr\b[^>]*>/gi, '\n');
  html = html.replace(/<\/(?:p|div|h[1-6]|tr)\s*>/gi, '\n\n');
  html = html.replace(/<(?:p|div|h[1-6])\b[^>]*>/gi, '\n\n');

  // 6. Everything else.
  html = html.replace(/<[^>]+>/g, '');

  // 7. Entities (after tags, so a decoded "<" can never re-open a tag).
  let text = decodeEntities(html);

  // 8. Collapse whitespace (spaces, tabs, and Unicode spaces; never newlines).
  const INLINE_WS = /[^\S\n]+/g;
  text = text.replace(/\r\n?/g, '\n');
  text = text
    .split('\n')
    .map((line) => line.replace(INLINE_WS, ' ').replace(/^ | $/g, ''))
    .join('\n');
  text = text.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');

  return {
    output: text,
    stats: {
      'input chars': input.text.length,
      'output chars': text.length,
      lines: text ? text.split('\n').length : 0,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
