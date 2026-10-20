import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './whitespace-visualizer.meta';

const CLEAN_ZERO_WIDTH = (() => {
  const points = [
    0x00ad, 0x034f, 0x061c, 0x115f, 0x1160, 0x17b4, 0x17b5, 0x180e, 0x200b, 0x200c, 0x200e, 0x200f,
    0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0x2066, 0x2067,
    0x2068, 0x2069, 0xfeff, 0xffa0,
  ];
  return new RegExp(
    `[${points.map((p) => `\\u${p.toString(16).padStart(4, '0')}`).join('')}]`,
    'gu',
  );
})();

const NBSP_RE = new RegExp(String.fromCharCode(0xa0), 'g');

const SPECIALS = new Map<number, string>([
  [0x09, 'TAB'],
  [0x0a, 'LF'],
  [0x0b, 'VT'],
  [0x0c, 'FF'],
  [0x0d, 'CR'],
  [0x20, 'SPACE'],
  [0xa0, 'NBSP'],
  [0xad, 'SOFT HYPHEN'],
  [0x1680, 'OGHAM SPACE MARK'],
  [0x180e, 'MONGOLIAN VOWEL SEPARATOR'],
  [0x2000, 'EN QUAD'],
  [0x2001, 'EM QUAD'],
  [0x2002, 'EN SPACE'],
  [0x2003, 'EM SPACE'],
  [0x2004, 'THREE-PER-EM SPACE'],
  [0x2005, 'FOUR-PER-EM SPACE'],
  [0x2006, 'SIX-PER-EM SPACE'],
  [0x2007, 'FIGURE SPACE'],
  [0x2008, 'PUNCTUATION SPACE'],
  [0x2009, 'THIN SPACE'],
  [0x200a, 'HAIR SPACE'],
  [0x200b, 'ZERO-WIDTH SPACE'],
  [0x200c, 'ZERO-WIDTH NON-JOINER'],
  [0x200d, 'ZERO-WIDTH JOINER'],
  [0x200e, 'LEFT-TO-RIGHT MARK'],
  [0x200f, 'RIGHT-TO-LEFT MARK'],
  [0x2028, 'LINE SEPARATOR'],
  [0x2029, 'PARAGRAPH SEPARATOR'],
  [0x202f, 'NARROW NBSP'],
  [0x205f, 'MEDIUM MATHEMATICAL SPACE'],
  [0x2060, 'WORD JOINER'],
  [0x3000, 'IDEOGRAPHIC SPACE'],
  [0xfeff, 'BYTE ORDER MARK'],
]);

function codePointLabel(codePoint: number): string {
  return `U+${codePoint
    .toString(16)
    .toUpperCase()
    .padStart(codePoint <= 0xffff ? 4 : 6, '0')}`;
}

function marker(label: string, codePoint: number): string {
  return `[${label} ${codePointLabel(codePoint)}]`;
}

function visualize(text: string): { output: string; visible: number } {
  let output = '';
  let visible = 0;

  for (let i = 0; i < text.length;) {
    const codePoint = text.codePointAt(i)!;
    const char = String.fromCodePoint(codePoint);
    const next = text.codePointAt(i + char.length);

    if (codePoint === 0x0d && next === 0x0a) {
      output += marker('CRLF', 0x0d);
      i += 2;
      visible += 1;
      continue;
    }

    let label = SPECIALS.get(codePoint);
    if (!label && codePoint < 0x20) label = 'CONTROL';
    if (!label && codePoint >= 0x7f && codePoint <= 0x9f) label = 'CONTROL';
    if (!label && /\p{Cf}/u.test(char)) label = 'FORMAT';
    if (!label && /\p{Zs}/u.test(char)) label = 'SPACE';

    if (label) {
      output += marker(label, codePoint);
      visible += 1;
    } else {
      output += char;
    }
    i += char.length;
  }

  return { output, visible };
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  if (options.mode === 'clean') {
    const output = input.text.replace(NBSP_RE, ' ').replace(CLEAN_ZERO_WIDTH, '');
    return {
      output,
      stats: {
        'NBSP converted': (input.text.match(NBSP_RE) ?? []).length,
        'zero-width formatting removed': (input.text.match(CLEAN_ZERO_WIDTH) ?? []).length,
      },
    };
  }

  const result = visualize(input.text);
  return {
    output: result.output,
    render: 'code',
    stats: {
      characters: [...input.text].length,
      'invisible characters shown': result.visible,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
