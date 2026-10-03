import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './data-size.meta';

const DECIMAL: Record<string, number> = { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, PB: 1e15 };
const BINARY: Record<string, number> = { KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4, PiB: 1024 ** 5 };
const BITS: Record<string, number> = { bit: 1, Kbit: 1e3, Mbit: 1e6, Gbit: 1e9 };
function bytesPer(unit: string): number {
  if (unit in DECIMAL) return DECIMAL[unit]!;
  if (unit in BINARY) return BINARY[unit]!;
  if (unit in BITS) return BITS[unit]! / 8;
  throw new ToolError(`Unknown data-size unit "${unit}".`);
}
function format(n: number): string {
  return Number(n.toPrecision(16)).toString();
}
function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const raw = input.text.trim().replace(/,/g, '');
  if (!raw) return { output: '' };
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new ToolError('Enter a finite numeric value.');
  const from = String(o.from);
  const to = String(o.to);
  const bytes = value * bytesPer(from);
  const result = bytes / bytesPer(to);
  const units: [string, number][] = [
    ['B', bytes], ['KB', bytes / 1e3], ['MB', bytes / 1e6], ['GB', bytes / 1e9],
    ['KiB', bytes / 1024], ['MiB', bytes / 1024 ** 2], ['GiB', bytes / 1024 ** 3], ['bits', bytes * 8],
  ];
  const rows = [[`Result (${to})`, format(result)], ...units.map(([unit, n]) => [unit, format(n)])];
  return {
    output: JSON.stringify({ headers: ['Unit', 'Value'], rows }),
    render: 'table',
    stats: { result: format(result), unit: to, bytes: format(bytes) },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
