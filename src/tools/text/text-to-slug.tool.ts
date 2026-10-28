import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './text-to-slug.meta';


const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'but',
  'or',
  'for',
  'nor',
  'with',
  'at',
  'by',
  'of',
  'to',
  'from',
  'in',
  'on',
  'into',
  'via',
  'against',
  'between',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'until',
  'while',
  'about',
  'as',
  'your',
]);

const ACCENT_OVERRIDES: Record<string, string> = {
  æ: 'ae',
  Æ: 'AE',
  œ: 'oe',
  Œ: 'OE',
  ß: 'ss',
  ø: 'o',
  Ø: 'O',
  đ: 'd',
  Đ: 'D',
  ł: 'l',
  Ł: 'L',
};

function transliterate(text: string): string {
  let out = '';
  for (const ch of text) {
    if (ACCENT_OVERRIDES[ch] !== undefined) {
      out += ACCENT_OVERRIDES[ch];
    } else {
      out += ch.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    }
  }
  return out;
}

interface SlugOpts {
  separator: string;
  lowercase: boolean;
  transliterate: boolean;
  removeStopwords: boolean;
  maxLength: number;
}

function slugify(text: string, opts: SlugOpts): string {
  let value = opts.transliterate ? transliterate(text) : text;
  if (opts.lowercase) value = value.toLowerCase();

  const sep = opts.separator;
  const re = opts.separator === '' ? /[^a-z0-9]+/gi : /[^a-z0-9]+/gi;
  value = value.replace(re, sep).split(sep).filter(Boolean).join(sep);

  if (opts.removeStopwords) {
    const words = value.split(sep);
    value = words.filter((w) => !STOPWORDS.has(w)).join(sep);
  }

  if (opts.maxLength > 0 && value.length > opts.maxLength) {
    if (sep !== '') {
      const parts: string[] = [];
      for (const part of value.split(sep)) {
        const candidate = parts.length === 0 ? part : parts.join(sep) + sep + part;
        if (candidate.length <= opts.maxLength) parts.push(part);
        else break;
      }
      value = parts.join(sep);
    } else {
      value = value.slice(0, opts.maxLength);
    }
  }

  if (sep !== '' && value.endsWith(sep)) value = value.slice(0, -1);
  return value;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const opts: SlugOpts = {
    separator: String(o.separator ?? '-'),
    lowercase: o.lowercase !== false,
    transliterate: o.transliterate !== false,
    removeStopwords: o.removeStopwords === true,
    maxLength: Math.max(0, Number(o.maxLength ?? 0)),
  };

  const raw = String(input.text ?? '');
  if (raw.trim() === '') throw new ToolError('Paste some text to turn into a slug.');

  const collapsed = raw.replace(/\s+/g, ' ').trim();
  const slug = slugify(collapsed, opts);

  if (slug === '') {
    throw new ToolError(
      'Nothing left after slugifying.',
      'Try toggling stopword removal or transliteration.',
    );
  }

  const notes = [
    opts.lowercase ? 'Lowercased.' : 'Case preserved.',
    opts.transliterate ? 'Diacritics → ASCII.' : 'Diacritics kept.',
  ];
  if (opts.removeStopwords) notes.push('Stopwords removed.');
  if (opts.maxLength > 0) notes.push('Capped at ' + opts.maxLength + ' chars (word boundary).');

  return {
    output: slug,
    render: 'text',
    language: 'text',
    stats: { in: collapsed.length, out: slug.length },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
