import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './words-to-number.meta';

const MAX_LEN = 10_000;

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Record<string, number> = {
  hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12,
};
const DIGITS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };

function parseWords(raw: string): number {
  const words = raw.toLowerCase().match(/[a-z]+|\d+/g) ?? [];
  let i = 0;
  let negative = false;
  let current = 0;
  let total = 0;
  let digitChain = false;
  let sawNumber = false;
  let decimalMantissa: number | null = null; // 0.abc… built as scaled digits

  for (; i < words.length; i++) {
    const w = words[i]!;
    if (!sawNumber && (w === 'negative' || w === 'minus')) { negative = true; continue; }
    if (w === 'and' || w === 'a') continue;
    if (w === 'point' && sawNumber) {
      let frac = 0;
      let place = 0.1;
      for (let j = i + 1; j < words.length; j++) {
        const dw = words[j]!;
        if (dw in DIGITS) {
          frac += DIGITS[dw]! * place;
          place /= 10;
          sawNumber = true;
        } else if (dw === 'point') {
          continue;
        } else {
          break;
        }
      }
      decimalMantissa = frac;
      i = words.length;
      break;
    }
    if (w in ONES) {
      const v = ONES[w]!;
      if (digitChain && v >= 1 && v <= 9) {
        current = current * 10 + v;
      } else {
        current += v;
        digitChain = true;
      }
      sawNumber = true;
      continue;
    }
    if (w in TENS) {
      current += TENS[w]!;
      digitChain = false;
      sawNumber = true;
      continue;
    }
    if (w in SCALES) {
      const scale = SCALES[w]!;
      if (scale === 100) {
        current = (current || 1) * 100;
      } else {
        total += (current || 1) * scale;
        current = 0;
      }
      digitChain = false;
      continue;
    }
    // Unknown word: ignore (e.g. "the total is two").
  }

  if (decimalMantissa !== null) {
    const base = total + current;
    const result = base + decimalMantissa;
    return negative ? -result : result;
  }
  if (!sawNumber) throw new ToolError('No number words found.', 'Example: two hundred thirty-four');
  const result = total + current;
  return negative ? -result : result;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const grouping = o.grouping !== false;
  const source = (input.text ?? '').trim();
  if (!source) throw new ToolError('Paste number words to convert to a number.');
  if (source.length > MAX_LEN) throw new ToolError('Input is too large.');

  const value = parseWords(source.trim().toLowerCase());
  if (!Number.isFinite(value) || Math.abs(value) > 1e15) {
    throw new ToolError('That number is too large to parse.', 'Supports up to trillions.');
  }

  const grouped = Math.abs(value) >= 1000
    ? value.toLocaleString('en-US')
    : String(value);

  return {
    output: (grouping ? grouped : String(value)) + '\n',
    render: 'text',
    language: 'text',
    stats: { number: value },
    notes: ['Parsed ' + (value < 0 ? 'as negative. ' : '') + 'to: ' + String(value) + '.'],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
