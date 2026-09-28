import type { TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { ToolError } from '@/lib/types';
import { meta } from './number-to-words.meta';

const SMALL = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = [
  '',
  'thousand',
  'million',
  'billion',
  'trillion',
  'quadrillion',
  'quintillion',
  'sextillion',
];
const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

function hundreds(value: number, useAnd: boolean): string {
  const parts: string[] = [];
  const hundredsDigit = Math.floor(value / 100);
  const remainder = value % 100;
  if (hundredsDigit > 0) parts.push(`${SMALL[hundredsDigit]} hundred`);
  if (remainder > 0) {
    if (hundredsDigit > 0 && useAnd) parts.push('and');
    if (remainder < 20) parts.push(SMALL[remainder]!);
    else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      parts.push(ones > 0 ? `${TENS[tens]}-${SMALL[ones]}` : TENS[tens]!);
    }
  }
  return parts.join(' ');
}

function integerWords(value: bigint, useAnd: boolean): string {
  if (value === 0n) return 'zero';
  const groups: string[] = [];
  let remaining = value;
  let scale = 0;
  while (remaining > 0n) {
    const group = Number(remaining % 1000n);
    if (group > 0) {
      const scaleName = SCALES[scale];
      if (scaleName === undefined) throw new ToolError('Number is too large to express in words.');
      groups.unshift(`${hundreds(group, useAnd)}${scaleName ? ` ${scaleName}` : ''}`);
    }
    remaining /= 1000n;
    scale += 1;
  }
  return groups.join(' ');
}

function ordinalWords(value: string): string {
  const words = value.split(' ');
  const last = words.pop()!;
  const pieces = last.split('-');
  const word = pieces.pop()!;
  const irregular: Record<string, string> = {
    one: 'first',
    two: 'second',
    three: 'third',
    five: 'fifth',
    eight: 'eighth',
    nine: 'ninth',
    twelve: 'twelfth',
    zero: 'zeroth',
    twenty: 'twentieth',
    thirty: 'thirtieth',
    forty: 'fortieth',
    fifty: 'fiftieth',
    sixty: 'sixtieth',
    seventy: 'seventieth',
    eighty: 'eightieth',
    ninety: 'ninetieth',
  };
  pieces.push(irregular[word] ?? (word.endsWith('y') ? `${word.slice(0, -1)}ieth` : `${word}th`));
  words.push(pieces.join('-'));
  return words.join(' ');
}

function applyCase(value: string, letterCase: string): string {
  if (letterCase === 'upper') return value.toUpperCase();
  if (letterCase === 'title') {
    return value.replace(/\b[a-z]+/g, (word) =>
      word === 'and' ? word : word.charAt(0).toUpperCase() + word.slice(1),
    );
  }
  if (letterCase === 'sentence') return value.charAt(0).toUpperCase() + value.slice(1);
  return value;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const text = input.text.trim();
  if (!text) return { output: '' };
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) {
    throw new ToolError(
      'Enter a numeric value.',
      'The input must be a plain number such as 123 or 3.14.',
    );
  }

  const style = String(o.style);
  const letterCase = String(o.letterCase);
  const useAnd = Boolean(o.useAnd);
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [integerPart, decimalPart] = unsigned.split('.');
  if (decimalPart && decimalPart.length > 4) {
    throw new ToolError('Decimals can have at most four places.');
  }
  if (style === 'ordinal' && decimalPart !== undefined) {
    throw new ToolError('Decimals cannot be converted to ordinal numbers.');
  }

  let output = integerWords(BigInt(integerPart!), useAnd);
  if (decimalPart !== undefined) {
    output += ` point ${Array.from(decimalPart, (digit) => DIGITS[Number(digit)]!).join(' ')}`;
  }
  if (negative) output = `negative ${output}`;
  if (style === 'ordinal') output = ordinalWords(output);
  output = applyCase(output, letterCase);

  return { output, stats: { style, words: output.split(/\s+/).length } };
}

const tool: TextToolModule = { meta, run };
export default tool;
