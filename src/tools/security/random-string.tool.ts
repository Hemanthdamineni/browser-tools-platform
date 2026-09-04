import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './random-string.meta';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';

const PRESETS: Record<string, string> = {
  alphanumeric: UPPER + LOWER + DIGITS,
  alpha: UPPER + LOWER,
  lowercase: LOWER,
  uppercase: UPPER,
  digits: DIGITS,
  'hex-lower': DIGITS + 'abcdef',
  'hex-upper': DIGITS + 'ABCDEF',
  base64url: UPPER + LOWER + DIGITS + '-_',
};

/** Uniform integer in [0, max) from the CSPRNG, using rejection sampling (no modulo bias). */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) throw new ToolError('Invalid random range.');
  if (max === 1) return 0;
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    const v = buf[0]!;
    if (v < limit) return v % max;
  }
}

function resolveCharset(charset: string, custom: string): string {
  if (charset === 'custom') {
    const set = [...new Set([...custom])].join('');
    if (set.length === 0) {
      throw new ToolError(
        'The custom character set is empty.',
        'Type the characters the string may contain.',
      );
    }
    return set;
  }
  return PRESETS[charset] ?? PRESETS.alphanumeric!;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);

  const rawLength = Math.floor(Number(o.length));
  if (!Number.isFinite(rawLength)) throw new ToolError('Length must be a number.');
  const length = Math.min(4096, Math.max(1, rawLength));

  const rawCount = Math.floor(Number(o.count));
  if (!Number.isFinite(rawCount)) throw new ToolError('Count must be a number.');
  const count = Math.min(200, Math.max(1, rawCount));

  const chars = resolveCharset(String(o.charset), String(o.custom ?? ''));

  const strings: string[] = [];
  for (let n = 0; n < count; n++) {
    let s = '';
    for (let i = 0; i < length; i++) s += chars[randomInt(chars.length)]!;
    strings.push(s);
  }

  const bits = Math.log2(chars.length) * length;

  return {
    output: strings.join('\n'),
    render: 'code',
    filename: 'random-strings.txt',
    stats: {
      'charset size': chars.length,
      length,
      'entropy (bits)': Math.round(bits),
      generated: count,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
