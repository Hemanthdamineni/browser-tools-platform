import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './text-to-binary.meta';

const MAX_LEN = 1_000_000;

function toBinaryBytes(text: string): string[] {
  const bytes = new TextEncoder().encode(text);
  const out: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    out.push(bytes[i]!.toString(2).padStart(8, '0'));
  }
  return out;
}

function fromBinary(bytes: number[]): string {
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

function normalizeBinary(raw: string): string {
  return raw.replace(/[^01]/g, '');
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode ?? 'encode');
  const groupBy = String(o.groupBy ?? '8') === '4' ? 4 : 8;
  const separator = String(o.separator ?? 'space') === 'none' ? '' : ' ';

  const source = input.text ?? '';
  if (!source.trim()) {
    throw new ToolError(mode === 'encode' ? 'Paste some text to encode.' : 'Paste binary to decode.', 'Try "Hi".');
  }
  if (source.length > MAX_LEN) {
    throw new ToolError('Input is too large.', 'Keep it under 1,000,000 characters.');
  }

  if (mode === 'encode') {
    const groups = toBinaryBytes(source);
    let output: string;
    if (groupBy === 8) {
      output = groups.join(separator);
    } else {
      output = groups.map((byte) => byte.match(/.{4}/g)!.join(separator === '' ? '' : ' ')).join(separator === '' ? '' : ' ');
    }
    return {
      output: output + '\n',
      render: 'text',
      language: 'text',
      stats: { bytes: groups.length, bits: groups.length * 8 },
      notes: ['UTF-8 encoded byte by byte.'],
    };
  }

  const normalized = normalizeBinary(source);
  if (normalized.length === 0) {
    throw new ToolError('No binary digits found.', 'Expected only 0s and 1s (spaces and newlines are ignored).');
  }
  if (normalized.length % 8 !== 0) {
    const valid = Math.ceil(normalized.length / 8) * 8;
    throw new ToolError('Binary length is not a multiple of 8.', `Found ${normalized.length} bits; the closest valid whole-byte length is ${valid} bits.`);
  }
  const bytes: number[] = [];
  for (let i = 0; i < normalized.length; i += 8) {
    bytes.push(parseInt(normalized.slice(i, i + 8), 2));
  }
  const decoded = fromBinary(bytes);
  return {
    output: decoded + '\n',
    render: 'text',
    language: 'text',
    stats: { bytes: bytes.length, bits: normalized.length },
    notes: ['Decoded UTF-8 bytes.'],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
