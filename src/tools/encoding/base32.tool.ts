import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './base32.meta';

const RFC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function alphabet(variant: string): string {
  return variant === 'crockford' ? CROCKFORD : RFC;
}

function encode(bytes: Uint8Array, variant: string, padding: boolean): string {
  const abc = alphabet(variant);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += abc[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += abc[(value << (5 - bits)) & 31];
  if (padding && variant === 'rfc4648') {
    while (out.length % 8 !== 0) out += '=';
  }
  return out;
}

function decode(input: string, variant: string): Uint8Array {
  const abc = alphabet(variant);
  let s = input.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  if (variant === 'crockford') s = s.replace(/O/g, '0').replace(/[IL]/g, '1');
  const lookup: Record<string, number> = {};
  for (let i = 0; i < abc.length; i++) lookup[abc[i]!] = i;

  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s) {
    if (!(ch in lookup)) {
      throw new ToolError(`"${ch}" is not valid Base32 for this alphabet.`);
    }
    value = (value << 5) | lookup[ch]!;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };
  const variant = String(o.variant);

  if (o.mode === 'decode') {
    const out = new TextDecoder('utf-8', { fatal: false }).decode(decode(input.text, variant));
    return { output: out, stats: { 'output chars': out.length } };
  }

  let out = encode(new TextEncoder().encode(input.text), variant, Boolean(o.padding));
  if (o.lowercase) out = out.toLowerCase();
  return { output: out, render: 'code', stats: { 'output chars': out.length } };
}

const tool: TextToolModule = { meta, run };
export default tool;
