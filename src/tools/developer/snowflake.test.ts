import { describe, it, expect } from 'vitest';
import tool from './snowflake.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as {
    output: string;
    stats?: Record<string, string | number>;
  };

/** Parse the table output into a field → value map. */
async function fields(text: string, options: Record<string, string | number | boolean> = {}) {
  const { output } = await run(text, options);
  const parsed = JSON.parse(output) as { headers: string[]; rows: string[][] };
  const map: Record<string, string> = {};
  for (const [k, v] of parsed.rows) map[k!] = v!;
  return map;
}

/** Build a Snowflake from its parts. */
const mk = (offsetMs: number, worker: number, proc: number, seq: number) =>
  (
    (BigInt(offsetMs) << 22n) |
    (BigInt(worker) << 17n) |
    (BigInt(proc) << 12n) |
    BigInt(seq)
  ).toString();

describe('snowflake', async () => {
  it('decodes the documented Discord example', async () => {
    const f = await fields('175928847299117063', { epoch: 'discord' });
    expect(f['Timestamp (ISO UTC)']).toBe('2016-04-30T11:18:25.796Z');
    expect(f['Unix time (ms)']).toBe('1462015105796');
    expect(f['Worker ID']).toBe('1');
    expect(f['Process ID']).toBe('0');
    expect(f['Increment / sequence']).toBe('7');
  });

  it('extracts worker, process, machine and sequence bits', async () => {
    const f = await fields(mk(5, 3, 2, 9), { epoch: 'discord' });
    expect(f['Worker ID']).toBe('3');
    expect(f['Process ID']).toBe('2');
    expect(f['Machine ID (10-bit)']).toBe('98'); // (3 << 5) | 2
    expect(f['Increment / sequence']).toBe('9');
    expect(f['Time since epoch (ms)']).toBe('5');
  });

  it('applies the twitter epoch', async () => {
    const f = await fields('0', { epoch: 'twitter' });
    expect(f['Unix time (ms)']).toBe('1288834974657');
    expect(f['Timestamp (ISO UTC)']).toBe(new Date(1288834974657).toISOString());
  });

  it('applies the instagram epoch', async () => {
    const f = await fields('0', { epoch: 'instagram' });
    expect(f['Unix time (ms)']).toBe('1314220021721');
  });

  it('applies a custom epoch', async () => {
    const f = await fields(mk(1000, 0, 0, 0), { epoch: 'custom', customEpoch: 0 });
    expect(f['Unix time (ms)']).toBe('1000');
    expect(f['Timestamp (ISO UTC)']).toBe('1970-01-01T00:00:01.000Z');
  });

  it('renders a 64-bit grouped binary string', async () => {
    const f = await fields('0', { epoch: 'discord' });
    expect(f['Binary']).toBe(
      `${'0'.repeat(42)} ${'0'.repeat(5)} ${'0'.repeat(5)} ${'0'.repeat(12)}`,
    );
    expect((await run('0')).stats?.epoch).toBe('1420070400000');
  });

  it('empty input → empty output', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('   ')).output).toBe('');
  });

  it('throws on non-numeric input', async () => {
    await expect(run('abc')).rejects.toThrow(ToolError);
    await expect(run('-5')).rejects.toThrow(ToolError);
    await expect(run('12.5')).rejects.toThrow(/decimal number/i);
  });

  it('throws when the value overflows 64 bits', async () => {
    await expect(run('18446744073709551616')).rejects.toThrow(/64 bits/i);
    expect(() => run('18446744073709551615')).not.toThrow();
  });

  it('throws on a negative custom epoch', async () => {
    await expect(run('123', { epoch: 'custom', customEpoch: -1 })).rejects.toThrow(ToolError);
  });
});
