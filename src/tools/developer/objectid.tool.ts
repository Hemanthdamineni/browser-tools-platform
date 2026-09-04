import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './objectid.meta';

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, hex2).join('');
}

function decode(raw: string): TextRunResult {
  const id = raw.trim().toLowerCase();
  if (id.length !== 24) {
    throw new ToolError(
      'An ObjectId is exactly 24 hexadecimal characters.',
      `Got ${id.length} character${id.length === 1 ? '' : 's'}.`,
    );
  }
  if (!/^[0-9a-f]{24}$/.test(id)) {
    throw new ToolError('An ObjectId may only contain 0-9 and a-f.');
  }

  const bytes = new Uint8Array(12);
  for (let i = 0; i < 12; i++) bytes[i] = parseInt(id.slice(i * 2, i * 2 + 2), 16);

  const seconds = (bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!;
  const unixSeconds = seconds >>> 0;
  const iso = new Date(unixSeconds * 1000).toISOString();

  const randomHex = bytesToHex(bytes.slice(4, 9));
  const counterHex = bytesToHex(bytes.slice(9, 12));
  const counter = (bytes[9]! << 16) | (bytes[10]! << 8) | bytes[11]!;

  const rows: string[][] = [
    ['Timestamp (ISO UTC)', iso],
    ['Unix time (seconds)', String(unixSeconds)],
    ['Timestamp bytes', id.slice(0, 8)],
    ['Random value (5 bytes)', randomHex],
    ['Counter (3 bytes, hex)', counterHex],
    ['Counter (decimal)', String(counter)],
  ];

  return {
    output: JSON.stringify({ headers: ['Field', 'Value'], rows }),
    render: 'table',
    stats: { 'unix seconds': unixSeconds },
  };
}

function generate(): TextRunResult {
  const bytes = new Uint8Array(12);
  const seconds = Math.floor(new Date().getTime() / 1000) >>> 0;
  bytes[0] = (seconds >>> 24) & 0xff;
  bytes[1] = (seconds >>> 16) & 0xff;
  bytes[2] = (seconds >>> 8) & 0xff;
  bytes[3] = seconds & 0xff;
  crypto.getRandomValues(bytes.subarray(4));

  const id = bytesToHex(bytes);
  return {
    output: id,
    render: 'code',
    language: 'text',
    stats: {
      'unix seconds': seconds,
      generated: new Date(seconds * 1000).toISOString(),
    },
  };
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);

  if (mode === 'generate') return generate();
  if (!input.text.trim()) return { output: '' };
  return decode(input.text);
}

const tool: TextToolModule = { meta, run };
export default tool;
