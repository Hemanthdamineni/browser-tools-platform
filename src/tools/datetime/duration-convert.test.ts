import { describe, it, expect } from 'vitest';
import tool from './duration-convert.tool';
import { ToolError } from '@/lib/types';

interface Res {
  output: string;
}
const run = async (
  text: string,
  options: Record<string, string | number | boolean> = {},
): Promise<Res> => await tool.run({ text, options });
const table = (r: Res) => JSON.parse(r.output) as { rows: string[][] };
const rowOf = (r: Res, key: string): string => {
  const found = table(r).rows.find((x) => x[0] === key);
  if (!found) throw new Error(`missing row ${key}`);
  return found[1]!;
};

describe('duration-convert', () => {
  it('converts 3661 seconds into every format', async () => {
    const r = await run('3661');
    expect(rowOf(r, 'Human')).toBe('1h 1m 1s');
    expect(rowOf(r, 'ISO 8601')).toBe('PT1H1M1S');
    expect(rowOf(r, 'Clock (HH:MM:SS)')).toBe('01:01:01');
    expect(rowOf(r, 'Total seconds')).toBe('3661');
  });

  it('parses an ISO 8601 duration', async () => {
    expect((await run('PT2H', { output: 'seconds' })).output).toBe('7200');
  });

  it('parses human durations with words and days', async () => {
    expect((await run('1d 12h', { output: 'seconds' })).output).toBe('129600');
    expect((await run('1 hour 30 minutes', { output: 'human' })).output).toBe('1h 30m');
    expect((await run('90m', { output: 'human' })).output).toBe('1h 30m');
  });

  it('reads a two-part clock value as MM:SS', async () => {
    expect((await run('01:30', { output: 'seconds' })).output).toBe('90');
    expect((await run('1:00:00', { output: 'seconds' })).output).toBe('3600');
  });

  it('forces seconds mode when selected', async () => {
    expect((await run('45', { mode: 'from-seconds', output: 'iso8601' })).output).toBe('PT45S');
    await expect(run('PT2H', { mode: 'from-seconds' })).rejects.toThrow(ToolError);
  });

  it('rejects unparseable durations', async () => {
    await expect(run('a while')).rejects.toThrow(ToolError);
    await expect(run('a while')).rejects.toThrow(/Could not read that duration/);
  });

  it('empty input gives empty output', async () => {
    expect((await run('')).output).toBe('');
  });
});
