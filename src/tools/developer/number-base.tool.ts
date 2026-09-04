import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './number-base.meta';

const PREFIX: Record<number, string> = { 2: '0b', 8: '0o', 16: '0x' };

function clampBase(value: unknown, fallback: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 2 || n > 36) return fallback;
  return n;
}

/** Group a digit string into blocks of 4, counted from the right. */
function group4(s: string): string {
  const parts: string[] = [];
  for (let i = s.length; i > 0; i -= 4) {
    parts.unshift(s.slice(Math.max(0, i - 4), i));
  }
  return parts.join(' ');
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  let raw = input.text.trim();
  let negative = false;
  if (raw.startsWith('-')) {
    negative = true;
    raw = raw.slice(1);
  } else if (raw.startsWith('+')) {
    raw = raw.slice(1);
  }

  raw = raw.replace(/[_\s',]/g, '');

  let fromBase = clampBase(o.fromBase, 10);
  const toBase = clampBase(o.toBase, 16);

  const pfx = raw.slice(0, 2).toLowerCase();
  if (pfx === '0x') {
    raw = raw.slice(2);
    fromBase = 16;
  } else if (pfx === '0o') {
    raw = raw.slice(2);
    fromBase = 8;
  } else if (pfx === '0b') {
    raw = raw.slice(2);
    fromBase = 2;
  }

  raw = raw.toLowerCase();
  if (!raw) throw new ToolError('No digits to convert.', 'Enter a number.');

  const bigFrom = BigInt(fromBase);
  let magnitude = 0n;
  for (const ch of raw) {
    const d = parseInt(ch, 36);
    if (Number.isNaN(d) || d >= fromBase) {
      throw new ToolError(
        `"${ch}" is not a valid digit for base ${fromBase}.`,
        'Check the "from base" option or the 0x / 0o / 0b prefix.',
      );
    }
    magnitude = magnitude * bigFrom + BigInt(d);
  }

  const sign = negative && magnitude !== 0n ? '-' : '';
  const digits = magnitude.toString(toBase);
  const prefix = o.addPrefix ? (PREFIX[toBase] ?? '') : '';
  const body = o.groupDigits ? group4(digits) : digits;

  return {
    output: sign + prefix + body,
    render: 'code',
    stats: {
      binary: sign + magnitude.toString(2),
      octal: sign + magnitude.toString(8),
      decimal: sign + magnitude.toString(10),
      hex: sign + magnitude.toString(16),
      'from base': fromBase,
      'to base': toBase,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
