import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './password.meta';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?/~|`';
const AMBIGUOUS = new Set('0O1lI|`');

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

function stripAmbiguous(s: string): string {
  return [...s].filter((c) => !AMBIGUOUS.has(c)).join('');
}

function shuffle(arr: string[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

function pick(pool: string): string {
  return pool[randomInt(pool.length)]!;
}

function strengthWord(bits: number): string {
  if (bits < 28) return 'very weak';
  if (bits < 36) return 'weak';
  if (bits < 60) return 'reasonable';
  if (bits < 128) return 'strong';
  return 'very strong';
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);

  const rawLength = Math.floor(Number(o.length));
  if (!Number.isFinite(rawLength)) throw new ToolError('Length must be a number.');
  const length = Math.min(128, Math.max(4, rawLength));

  const rawCount = Math.floor(Number(o.count));
  if (!Number.isFinite(rawCount)) throw new ToolError('Count must be a number.');
  const count = Math.min(50, Math.max(1, rawCount));

  const avoid = Boolean(o.avoidAmbiguous);
  const classes: string[] = [];
  if (o.uppercase) classes.push(avoid ? stripAmbiguous(UPPER) : UPPER);
  if (o.lowercase) classes.push(avoid ? stripAmbiguous(LOWER) : LOWER);
  if (o.digits) classes.push(avoid ? stripAmbiguous(DIGITS) : DIGITS);
  if (o.symbols) classes.push(avoid ? stripAmbiguous(SYMBOLS) : SYMBOLS);

  const usable = classes.filter((c) => c.length > 0);
  if (usable.length === 0) {
    throw new ToolError(
      'Select at least one character type.',
      'Enable uppercase, lowercase, digits or symbols.',
    );
  }
  if (usable.length > length) {
    throw new ToolError(
      'Length is too short for the selected character types.',
      `Use a length of at least ${usable.length}.`,
    );
  }

  const pool = [...new Set([...usable.join('')])].join('');

  const passwords: string[] = [];
  for (let n = 0; n < count; n++) {
    const chars: string[] = usable.map((cls) => pick(cls));
    while (chars.length < length) chars.push(pick(pool));
    shuffle(chars);
    passwords.push(chars.join(''));
  }

  const bits = Math.log2(pool.length) * length;

  return {
    output: passwords.join('\n'),
    render: 'code',
    filename: 'passwords.txt',
    stats: {
      'pool size': pool.length,
      'entropy (bits)': Math.round(bits),
      strength: strengthWord(bits),
      generated: count,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
