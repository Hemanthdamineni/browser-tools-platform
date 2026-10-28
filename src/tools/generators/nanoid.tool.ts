import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './nanoid.meta';

const ALPHABETS: Record<string, string> = {
  'url-safe': 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  hex: '0123456789abcdef',
  alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
};

function pickUnbiased(alphabet: string, size: number): string {
  const len = alphabet.length;
  const mask = (2 << Math.floor(Math.log2(len - 1))) - 1;
  const step = Math.ceil((1.6 * mask * size) / len);
  let id = '';
  const bytes = new Uint8Array(step);
  while (id.length < size) {
    crypto.getRandomValues(bytes);
    for (let i = 0; i < step && id.length < size; i++) {
      const b = bytes[i]! & mask;
      if (b < len) id += alphabet[b];
    }
  }
  return id;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const size = Math.max(2, Math.floor(Number(o.size ?? 21)));
  const count = Math.max(1, Math.floor(Number(o.count ?? 1)));
  const key = String(o.alphabet ?? 'url-safe');
  const alphabet = key === 'custom' ? String(o.custom ?? '') : ALPHABETS[key];
  if (!alphabet || alphabet.length < 2) {
    throw new ToolError('Enter a custom alphabet with at least 2 characters.');
  }

  const ids: string[] = [];
  for (let i = 0; i < count; i++) ids.push(pickUnbiased(alphabet, size));

  const entropy = size * Math.log2(alphabet.length);
  return {
    output: ids.join('\n'),
    render: 'code',
    filename: 'nanoids.txt',
    stats: {
      generated: count,
      alphabet: `${alphabet.length} chars`,
      'entropy per id': `${Math.round(entropy)} bits`,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
