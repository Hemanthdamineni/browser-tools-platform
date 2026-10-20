import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './html-entity.meta';

const MAX_LEN = 1_000_000;

/** Named HTML entities used for decoding (commonly used set; unknown names are left untouched). */
const NAME_TABLE: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
  copy: '\u00A9',
  reg: '\u00AE',
  trade: '\u2122',
  eacute: '\u00E9',
  agrave: '\u00E0',
  egrave: '\u00E8',
  ouml: '\u00F6',
  auml: '\u00E4',
  uuml: '\u00FC',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
  laquo: '\u00AB',
  raquo: '\u00BB',
  euro: '\u20AC',
  pound: '\u00A3',
  yen: '\u00A5',
  cent: '\u00A2',
  sect: '\u00A7',
  para: '\u00B6',
  middot: '\u00B7',
  deg: '\u00B0',
  plusmn: '\u00B1',
  times: '\u00D7',
  divide: '\u00F7',
};

function encode(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decode(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const cp = Number.parseInt(body.slice(2), 16);
      return Number.isNaN(cp) ? match : safeFromCodePoint(cp, match);
    }
    if (body.startsWith('#')) {
      const cp = Number.parseInt(body.slice(1), 10);
      return Number.isNaN(cp) ? match : safeFromCodePoint(cp, match);
    }
    const named = NAME_TABLE[body];
    return named ? named : match;
  });
}

function safeFromCodePoint(cp: number, fallback: string): string {
  if (cp > 0x10ffff || cp === 0 || (cp >= 0xd800 && cp <= 0xdfff)) return fallback;
  // Well-formedness: leave as fallback (the original entity text).
  try {
    return String.fromCodePoint(cp);
  } catch {
    return fallback;
  }
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode ?? 'auto');
  const encodeAll = o.encodeAll === true;
  const source = input.text ?? '';
  if (!source.trim()) throw new ToolError('Paste text to encode or decode.');
  if (source.length > MAX_LEN)
    throw new ToolError('Input is too large.', 'Keep it under 1,000,000 characters.');

  let direction: 'encode' | 'decode';
  if (mode === 'auto') {
    const hasEntity = /&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i.test(source);
    const hasMarkup = /[<>]/.test(source);
    direction = hasEntity && !hasMarkup ? 'decode' : 'encode';
  } else {
    direction = mode as 'encode' | 'decode';
  }

  let output: string;
  if (direction === 'encode') {
    output = encodeAll ? encodeAllMarkup(source) : encode(source);
  } else {
    output = decode(source);
  }

  return {
    output: output + '\n',
    render: 'text',
    language: 'text',
    stats: { direction: direction === 'encode' ? 0 : 1 },
    notes: [
      direction === 'encode'
        ? 'Encoded to HTML entities (auto).'
        : 'Decoded HTML entities to text (auto).',
      encodeAll && direction === 'encode'
        ? 'All printable non-ASCII replaced by numeric entities.'
        : '',
    ].filter(Boolean),
  };
}

function encodeAllMarkup(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (ch === '&') {
      out += '&amp;';
      continue;
    }
    if (ch === '<') {
      out += '&lt;';
      continue;
    }
    if (ch === '>') {
      out += '&gt;';
      continue;
    }
    if (ch === '"') {
      out += '&quot;';
      continue;
    }
    if (ch === "'") {
      out += '&#39;';
      continue;
    }
    if (code > 126 || code < 32) out += '&#' + code + ';';
    else out += ch;
  }
  return out;
}

const tool: TextToolModule = { meta, run };
export default tool;
