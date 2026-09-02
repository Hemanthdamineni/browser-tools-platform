import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './uuid.meta';

const hex = (n: number) => n.toString(16).padStart(2, '0');

function bytesToUuid(b: Uint8Array): string {
  const s = Array.from(b, hex).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

function v4(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  return bytesToUuid(b);
}

function v7(now: number): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  const ts = BigInt(now);
  b[0] = Number((ts >> 40n) & 0xffn);
  b[1] = Number((ts >> 32n) & 0xffn);
  b[2] = Number((ts >> 24n) & 0xffn);
  b[3] = Number((ts >> 16n) & 0xffn);
  b[4] = Number((ts >> 8n) & 0xffn);
  b[5] = Number(ts & 0xffn);
  b[6] = (b[6]! & 0x0f) | 0x70;
  b[8] = (b[8]! & 0x3f) | 0x80;
  return bytesToUuid(b);
}

const NIL = '00000000-0000-0000-0000-000000000000';

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const version = String(o.version ?? 'v4');
  const count = Math.min(1000, Math.max(1, Math.floor(Number(o.count ?? 1))));
  if (!Number.isFinite(count)) throw new ToolError('Count must be a number.');

  const base = Date.now();
  const list: string[] = [];
  for (let i = 0; i < count; i++) {
    let id = version === 'nil' ? NIL : version === 'v7' ? v7(base + i) : v4();
    if (!o.hyphens) id = id.replace(/-/g, '');
    if (o.uppercase) id = id.toUpperCase();
    if (o.braces) id = `{${id}}`;
    list.push(id);
  }

  return {
    output: list.join('\n'),
    render: 'code',
    filename: 'uuids.txt',
    stats: { generated: count, version },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
