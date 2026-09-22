import { describe, it, expect } from 'vitest';
import tool from './date-diff.tool';
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

describe('date-diff', () => {
  it('counts 366 days across a leap year', async () => {
    const r = await run('2020-01-01', { second: '2021-01-01' });
    expect(rowOf(r, 'Total days')).toBe('366');
    expect(rowOf(r, 'Calendar breakdown')).toBe('1 years, 0 months, 0 days');
  });

  it('counts business days, skipping weekends', async () => {
    const r = await run('2024-01-01', { second: '2024-01-08' });
    expect(rowOf(r, 'Business days')).toBe('5');
  });

  it('handles a reversed order with the same magnitude', async () => {
    const r = await run('2021-01-01', { second: '2020-01-01' });
    expect(rowOf(r, 'Total days')).toBe('-366');
    expect(rowOf(r, 'Relation')).toBe('A is before B');
  });

  it('borrows months and days in the calendar breakdown', async () => {
    const r = await run('2024-01-31', { second: '2024-03-01' });
    expect(rowOf(r, 'Calendar breakdown')).toBe('0 years, 0 months, 30 days');
    expect(rowOf(r, 'Total complete months')).toBe('0');
  });

  it('equal dates report zero everywhere', async () => {
    const r = await run('2024-06-01', { second: '2024-06-01' });
    expect(rowOf(r, 'Total days')).toBe('0');
    expect(rowOf(r, 'Relation')).toBe('A is equal to B');
  });

  it('rejects an unparseable date', async () => {
    await expect(run('someday', { second: '2024-01-01' })).rejects.toThrow(ToolError);
    await expect(run('2024-01-01', { second: 'someday' })).rejects.toThrow(
      /valid date for the second date/,
    );
  });
});
