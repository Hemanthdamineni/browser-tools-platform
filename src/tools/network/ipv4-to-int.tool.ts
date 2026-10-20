import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './ipv4-to-int.meta';

const MAX = 4294967295;

function ipToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim());
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return parts.reduce((acc: number, p: number) => acc * 256 + p, 0);
}

function intToIp(value: number): string {
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join('.');
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const showBoth = o.showBoth !== false;
  const source = (input.text ?? '').trim();
  if (!source) throw new ToolError('Enter an IPv4 address or an integer to convert.');

  const asInt = ipToInt(source);
  let output: string;
  let stats: Record<string, number>;
  let reverse = '';

  if (asInt !== null) {
    output = String(asInt);
    reverse = source;
    stats = { integer: asInt };
  } else if (/^\d+$/.test(source)) {
    const n = Number(source);
    if (n > MAX)
      throw new ToolError('Value is too large.', 'IPv4 integers range from 0 to 4294967295.');
    output = intToIp(n);
    reverse = String(n);
    stats = { integer: n };
  } else {
    throw new ToolError('Not a valid IPv4 or integer.', 'Examples: 192.168.1.1 or 3232235777');
  }

  const display = showBoth ? output + '  (' + reverse + ')' : output;
  return {
    output: display + '\n',
    render: 'text',
    language: 'text',
    stats,
    notes: [
      asInt !== null
        ? 'Dotted IPv4 converted to its unsigned 32-bit integer.'
        : 'Integer converted to a dotted IPv4.',
    ].filter(Boolean),
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
