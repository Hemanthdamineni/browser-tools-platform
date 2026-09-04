import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './snowflake.meta';

const KNOWN_EPOCHS: Record<string, bigint> = {
  twitter: 1288834974657n,
  discord: 1420070400000n,
  instagram: 1314220021721n,
};

const U64_MAX = (1n << 64n) - 1n;

function resolveEpoch(epoch: string, customEpoch: number): bigint {
  if (epoch === 'custom') {
    if (!Number.isFinite(customEpoch) || customEpoch < 0) {
      throw new ToolError('Custom epoch must be a non-negative number of milliseconds.');
    }
    return BigInt(Math.trunc(customEpoch));
  }
  return KNOWN_EPOCHS[epoch] ?? KNOWN_EPOCHS.discord!;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const raw = input.text.trim();
  if (!raw) return { output: '' };

  if (!/^\d+$/.test(raw)) {
    throw new ToolError(
      'A Snowflake ID must be a decimal number.',
      'Digits only, e.g. 175928847299117063',
    );
  }

  const id = BigInt(raw);
  if (id > U64_MAX) {
    throw new ToolError(
      'That value does not fit in 64 bits.',
      'The largest Snowflake ID is 18446744073709551615.',
    );
  }

  const epoch = resolveEpoch(String(o.epoch), Number(o.customEpoch));

  const timestampOffset = id >> 22n;
  const workerId = (id >> 17n) & 0x1fn;
  const processId = (id >> 12n) & 0x1fn;
  const sequence = id & 0xfffn;
  const machineId = (id >> 12n) & 0x3ffn;

  const unixMs = timestampOffset + epoch;
  const date = new Date(Number(unixMs));
  const iso = Number.isFinite(date.getTime()) ? date.toISOString() : 'out of range';

  const binary = id.toString(2).padStart(64, '0');
  const grouped = `${binary.slice(0, 42)} ${binary.slice(42, 47)} ${binary.slice(47, 52)} ${binary.slice(52)}`;

  const rows: string[][] = [
    ['Timestamp (ISO UTC)', iso],
    ['Unix time (ms)', unixMs.toString()],
    ['Time since epoch (ms)', timestampOffset.toString()],
    ['Worker ID', workerId.toString()],
    ['Process ID', processId.toString()],
    ['Machine ID (10-bit)', machineId.toString()],
    ['Increment / sequence', sequence.toString()],
    ['Binary', grouped],
  ];

  return {
    output: JSON.stringify({ headers: ['Field', 'Value'], rows }),
    render: 'table',
    stats: {
      epoch: epoch.toString(),
      'worker bits': '5',
      'sequence bits': '12',
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
