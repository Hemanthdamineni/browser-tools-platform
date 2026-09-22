import type { TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { ToolError } from '@/lib/types';
import { meta } from './roman-numeral.meta';

const PAIRS: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

function toRoman(n: number, extended: boolean): string {
  if (!Number.isInteger(n) || n < 1) {
    throw new ToolError('Enter a positive whole number.', 'Roman numerals start at 1.');
  }
  if (!extended && n > 3999) {
    throw new ToolError(
      'Number must be between 1 and 3999.',
      'Turn on extended range for vinculum (parenthesised) notation.',
    );
  }
  if (extended && n > 3999999) {
    throw new ToolError('Number must be between 1 and 3,999,999.');
  }
  const encode = (v: number): string => {
    let out = '';
    for (const [val, sym] of PAIRS) {
      while (v >= val) {
        out += sym;
        v -= val;
      }
    }
    return out;
  };
  if (extended && n >= 4000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    return `(${encode(thousands)})${encode(rest)}`;
  }
  return encode(n);
}

function fromRoman(s: string, extended: boolean): number {
  const upper = s.toUpperCase().replace(/\s+/g, '');
  if (!upper) throw new ToolError('Enter a Roman numeral.');
  const decode = (part: string): number => {
    let total = 0;
    let i = 0;
    while (i < part.length) {
      const pair = PAIRS.find(([, sym]) => part.startsWith(sym, i));
      if (!pair)
        throw new ToolError('That is not a valid Roman numeral.', 'Use only I, V, X, L, C, D, M.');
      total += pair[0];
      i += pair[1].length;
    }
    return total;
  };
  let body = upper;
  let prefix = 0;
  const m = /^\(([IVXLCDM]+)\)(.*)$/.exec(body);
  if (m && m[1] && m[2] !== undefined) {
    if (!extended) {
      throw new ToolError(
        'That is not a valid Roman numeral.',
        'Parenthesised (vinculum) notation needs extended range enabled.',
      );
    }
    prefix = decode(m[1]);
    body = m[2];
  }
  if (extended && /\(/.test(body)) {
    throw new ToolError('Only one parenthesised thousands group is supported.');
  }
  const value = prefix * 1000 + decode(body);
  // Canonical check rejects IIII, VX, IIX, etc.
  if (toRoman(value, extended) !== upper) {
    throw new ToolError(
      'That is not a valid Roman numeral.',
      'Use strict subtractive form, e.g. IV not IIII.',
    );
  }
  return value;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const text = input.text.trim();
  if (!text) return { output: '' };
  const extended = Boolean(o.extended);
  let mode = String(o.mode);
  if (mode === 'auto') {
    mode = /^[IVXLCDM()]+$/i.test(text) ? 'to-number' : 'to-roman';
  }
  if (mode === 'to-number') {
    const value = fromRoman(text, extended);
    return { output: String(value), stats: { roman: text.toUpperCase(), value } };
  }
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1) {
    throw new ToolError('Enter a positive whole number.', 'Roman numerals start at 1.');
  }
  const roman = toRoman(n, extended);
  return { output: roman, render: 'code', stats: { value: n, roman } };
}

const tool: TextToolModule = { meta, run };
export default tool;
