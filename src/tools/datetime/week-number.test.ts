import { describe, it, expect } from 'vitest';
import tool from './week-number.tool';
import { ToolError } from '@/lib/types';

interface Res {
  output: string;
  stats?: Record<string, string | number>;
}
const run = async (text: string): Promise<Res> => await tool.run({ text, options: {} });
const table = (r: Res) => JSON.parse(r.output) as { rows: string[][] };
const rowOf = (r: Res, key: string): string => {
  const found = table(r).rows.find((x) => x[0] === key);
  if (!found) throw new Error(`missing row ${key}`);
  return found[1]!;
};

describe('week-number', () => {
  it('places 2024-01-01 in ISO week 1 of 2024', async () => {
    const r = await run('2024-01-01');
    expect(rowOf(r, 'ISO week number')).toBe('1');
    expect(rowOf(r, 'ISO week-year')).toBe('2024');
    expect(rowOf(r, 'Day of year')).toBe('1');
    expect(rowOf(r, 'Leap year')).toBe('Yes');
    expect(rowOf(r, 'ISO week start (Mon)')).toBe('2024-01-01');
    expect(rowOf(r, 'ISO week end (Sun)')).toBe('2024-01-07');
  });

  it('maps 2021-01-01 into week 53 of 2020', async () => {
    const r = await run('2021-01-01');
    expect(rowOf(r, 'ISO week number')).toBe('53');
    expect(rowOf(r, 'ISO week-year')).toBe('2020');
  });

  it('knows the last day of a leap year', async () => {
    const r = await run('2024-12-31');
    expect(rowOf(r, 'Day of year')).toBe('366');
    expect(rowOf(r, 'Days remaining in year')).toBe('0');
  });

  it('reports quarter and ordinal facts mid-year', async () => {
    const r = await run('2023-04-15');
    expect(rowOf(r, 'Quarter')).toBe('Q2');
    expect(rowOf(r, 'Day of quarter')).toBe('15');
    expect(rowOf(r, 'Leap year')).toBe('No');
    expect(rowOf(r, 'Ordinal date')).toBe('2023-105');
  });

  it('uses today when the input is empty', async () => {
    const r = await run('');
    expect(table(r).rows.length).toBe(10);
    expect(String(r.stats!.week)).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('rejects an unparseable date', async () => {
    await expect(run('sometime')).rejects.toThrow(ToolError);
    await expect(run('sometime')).rejects.toThrow(/not a valid date/);
  });
});
