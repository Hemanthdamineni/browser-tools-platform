import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './base58.meta';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE = 58n;

function encode(bytes: Uint8Array): string {
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) leadingZeros++;

  let value = 0n;
  for (const b of bytes) value = value * 256n + BigInt(b);

  let digits = '';
  while (value > 0n) {
    const rem = Number(value % BASE);
    value /= BASE;
    digits = ALPHABET[rem]! + digits;
  }

  return '1'.repeat(leadingZeros) + digits;
}

function decode(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);

  let leadingOnes = 0;
  while (leadingOnes < str.length && str[leadingOnes] === '1') leadingOnes++;

  let value = 0n;
  for (const ch of str) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) {
      throw new ToolError(
        `"${ch}" is not a valid Base58 character.`,
        'The Bitcoin/IPFS alphabet has no 0, O, I, l or whitespace.',
      );
    }
    value = value * BASE + BigInt(idx);
  }

  const tail: number[] = [];
  while (value > 0n) {
    tail.unshift(Number(value % 256n));
    value /= 256n;
  }

  const out = new Uint8Array(leadingOnes + tail.length);
  out.set(tail, leadingOnes);
  return out;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  if (o.mode === 'decode') {
    const bytes = decode(input.text.trim());
    const out = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return { output: out, stats: { 'output bytes': bytes.length } };
  }

  const bytes = new TextEncoder().encode(input.text);
  const out = encode(bytes);
  return {
    output: out,
    render: 'code',
    stats: { 'input bytes': bytes.length, 'output chars': out.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
