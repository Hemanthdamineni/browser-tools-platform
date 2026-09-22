import { describe, it, expect } from 'vitest';
import tool from './date-add.tool';
import { ToolError } from '@/lib/types';

interface Res {
  output: string;
  stats?: Record<string, string | number>;
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

describe('date-add', () => {
  it('clamps January 31 + 1 month into a leap February', async () => {
    const r = await run('2024-01-31', { months: 1 });
    expect(rowOf(r, 'ISO 8601')).toMatch(/^2024-02-29T00:00:00/);
  });

  it('clamps January 31 + 1 month into a common February', async () => {
    const r = await run('2023-01-31', { months: 1 });
    expect(rowOf(r, 'ISO 8601')).toMatch(/^2023-02-28T00:00:00/);
  });

  it('subtracts one day across the leap-day boundary', async () => {
    const r = await run('2024-03-01', { operation: 'subtract', days: 1 });
    expect(rowOf(r, 'ISO 8601')).toMatch(/^2024-02-29T00:00:00/);
    expect(rowOf(r, 'Days from base')).toBe('-1 day');
  });

  it('adds time-of-day units', async () => {
    const r = await run('2024-01-01T00:00:00Z', { minutes: 90 });
    expect(rowOf(r, 'ISO 8601')).toBe('2024-01-01T01:30:00.000Z');
  });

  it('combines years, weeks and hours', async () => {
    const r = await run('2024-01-01', { years: 1, weeks: 1, hours: 2 });
    expect(rowOf(r, 'ISO 8601')).toMatch(/^2025-01-08T02:00:00/);
    expect(rowOf(r, 'Weekday')).toBe('Wednesday');
  });

  it('rejects an unparseable base date', async () => {
    await expect(run('whenever', { days: 1 })).rejects.toThrow(ToolError);
    await expect(run('whenever', { days: 1 })).rejects.toThrow(/not a valid date/);
  });
});
