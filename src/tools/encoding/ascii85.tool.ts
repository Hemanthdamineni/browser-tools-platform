import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './ascii85.meta';

const Z85_ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';

const MAX_U32 = 0xffffffff;
const POW32 = 4294967296;

function fiveChars(value: number): string {
  const d = new Array<string>(5);
  for (let k = 4; k >= 0; k--) {
    d[k] = String.fromCharCode(33 + (value % 85));
    value = Math.floor(value / 85);
  }
  return d.join('');
}

function bytesOf(value: number): [number, number, number, number] {
  return [
    Math.floor(value / 0x1000000) & 0xff,
    Math.floor(value / 0x10000) & 0xff,
    Math.floor(value / 0x100) & 0xff,
    value & 0xff,
  ];
}

function encode(bytes: Uint8Array, variant: string): string {
  if (variant === 'z85') {
    if (bytes.length % 4 !== 0) {
      throw new ToolError(
        'Z85 requires the input length to be a multiple of 4 bytes.',
        `Got ${bytes.length} UTF-8 byte${bytes.length === 1 ? '' : 's'}.`,
      );
    }
    let out = '';
    for (let i = 0; i < bytes.length; i += 4) {
      let value = 0;
      for (let j = 0; j < 4; j++) value = value * 256 + bytes[i + j]!;
      const d = new Array<string>(5);
      for (let k = 4; k >= 0; k--) {
        d[k] = Z85_ALPHABET[value % 85]!;
        value = Math.floor(value / 85);
      }
      out += d.join('');
    }
    return out;
  }

  let out = '';
  const full = Math.floor(bytes.length / 4) * 4;
  for (let i = 0; i < full; i += 4) {
    const value =
      bytes[i]! * 0x1000000 + bytes[i + 1]! * 0x10000 + bytes[i + 2]! * 0x100 + bytes[i + 3]!;
    if (value === 0) {
      out += 'z';
    } else if (variant === 'btoa' && value === 0x20202020) {
      out += 'y';
    } else {
      out += fiveChars(value);
    }
  }

  const rem = bytes.length - full;
  if (rem > 0) {
    let value = 0;
    for (let j = 0; j < 4; j++) value = value * 256 + (j < rem ? bytes[full + j]! : 0);
    out += fiveChars(value).slice(0, rem + 1);
  }

  return variant === 'adobe' ? `<~${out}~>` : out;
}

function decode(input: string, variant: string): Uint8Array {
  if (variant === 'z85') {
    const s = input.replace(/\s/g, '');
    if (s.length % 5 !== 0) {
      throw new ToolError('Z85 input length must be a multiple of 5 characters.');
    }
    const lookup: Record<string, number> = {};
    for (let i = 0; i < Z85_ALPHABET.length; i++) lookup[Z85_ALPHABET[i]!] = i;

    const out: number[] = [];
    for (let i = 0; i < s.length; i += 5) {
      let value = 0;
      for (let j = 0; j < 5; j++) {
        const ch = s[i + j]!;
        const v = lookup[ch];
        if (v === undefined) {
          throw new ToolError(`"${ch}" is not a valid Z85 character.`);
        }
        value = value * 85 + v;
      }
      if (value > MAX_U32) throw new ToolError('A Z85 group is out of range.');
      out.push(...bytesOf(value));
    }
    return new Uint8Array(out);
  }

  let s = input.trim();
  if (s.startsWith('<~')) s = s.slice(2);
  if (s.endsWith('~>')) s = s.slice(0, -2);
  s = s.replace(/\s/g, '');

  const out: number[] = [];
  let group: number[] = [];

  const flush = (count: number) => {
    const padded = group.slice();
    while (padded.length < 5) padded.push(84);
    let value = 0;
    for (let j = 0; j < 5; j++) value = value * 85 + padded[j]!;
    if (count === 5 && value > MAX_U32) {
      throw new ToolError('An Ascii85 group is out of range.');
    }
    const b = bytesOf(value % POW32);
    for (let j = 0; j < count - 1; j++) out.push(b[j]!);
    group = [];
  };

  for (const ch of s) {
    if (group.length === 0 && ch === 'z') {
      out.push(0, 0, 0, 0);
      continue;
    }
    if (group.length === 0 && ch === 'y' && variant === 'btoa') {
      out.push(0x20, 0x20, 0x20, 0x20);
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code < 33 || code > 117) {
      throw new ToolError(`"${ch}" is not a valid Ascii85 character.`);
    }
    group.push(code - 33);
    if (group.length === 5) flush(5);
  }

  if (group.length === 1) {
    throw new ToolError('Ascii85 data ends with a dangling character (a group needs 2–5 chars).');
  }
  if (group.length > 0) flush(group.length);

  return new Uint8Array(out);
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };
  const variant = String(o.variant);

  if (o.mode === 'decode') {
    const bytes = decode(input.text, variant);
    const out = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return { output: out, stats: { 'output bytes': bytes.length } };
  }

  const bytes = new TextEncoder().encode(input.text);
  const out = encode(bytes, variant);
  return {
    output: out,
    render: 'code',
    stats: { 'input bytes': bytes.length, 'output chars': out.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
