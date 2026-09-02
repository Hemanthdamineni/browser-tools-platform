import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './hex.meta';

function encode(text: string, separator: string, uppercase: boolean): string {
  const bytes = new TextEncoder().encode(text);
  const hexes: string[] = [];
  for (const b of bytes) {
    let h = b.toString(16).padStart(2, '0');
    if (uppercase) h = h.toUpperCase();
    hexes.push(h);
  }
  switch (separator) {
    case 'none':
      return hexes.join('');
    case 'colon':
      return hexes.join(':');
    case '0x':
      return hexes.map((h) => `0x${h}`).join(' ');
    case 'backslash-x':
      return hexes.map((h) => `\\x${h}`).join('');
    default:
      return hexes.join(' ');
  }
}

function decode(input: string): string {
  const clean = input
    .replace(/0x/gi, '')
    .replace(/\\x/gi, '')
    .replace(/[^0-9a-fA-F]/g, '');
  if (clean.length === 0) return '';
  if (clean.length % 2 !== 0) {
    throw new ToolError(
      'Hex input has an odd number of digits.',
      'Every byte needs two hex characters.',
    );
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  if (o.mode === 'decode') {
    const out = decode(input.text);
    return {
      output: out,
      stats: { 'output chars': out.length },
      notes: out.includes('�')
        ? ['Contains replacement characters — the bytes may not be UTF-8.']
        : undefined,
    };
  }

  const out = encode(input.text, String(o.separator), Boolean(o.uppercase));
  return {
    output: out,
    render: 'code',
    stats: { bytes: new TextEncoder().encode(input.text).length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
