import { describe, it, expect } from 'vitest';
import tool from './age-calculator.tool';
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

describe('age-calculator', () => {
  it('computes an exact whole-year age', async () => {
    const r = await run('2000-01-01', { asOf: '2024-01-01' });
    expect(rowOf(r, 'Age')).toBe('24 years, 0 months, 0 days');
    expect(rowOf(r, 'Day of week born')).toBe('Saturday');
    expect(rowOf(r, 'Western zodiac sign')).toBe('Capricorn');
    expect(rowOf(r, 'Days until next birthday')).toBe('0');
  });

  it('is one day short of 24 years', async () => {
    const r = await run('2000-06-15', { asOf: '2024-06-14' });
    expect(rowOf(r, 'Age')).toMatch(/^23 years, 11 months, 30 days$/);
  });

  it('reports lifetime totals and the next birthday', async () => {
    const r = await run('2000-06-15', { asOf: '2024-06-14' });
    expect(rowOf(r, 'Total days')).toBe('8765');
    expect(rowOf(r, 'Next birthday')).toBe('2024-06-15');
    expect(rowOf(r, 'Days until next birthday')).toBe('1');
    expect(rowOf(r, 'Western zodiac sign')).toBe('Gemini');
  });

  it('rolls the next birthday into next year when passed', async () => {
    const r = await run('2000-06-15', { asOf: '2024-06-20' });
    expect(rowOf(r, 'Next birthday')).toBe('2025-06-15');
  });

  it('rejects a future birth date', async () => {
    await expect(run('2030-01-01', { asOf: '2024-01-01' })).rejects.toThrow(ToolError);
    await expect(run('2030-01-01', { asOf: '2024-01-01' })).rejects.toThrow(/on or before/);
  });

  it('rejects an unparseable birth date and gives empty output for empty input', async () => {
    await expect(run('a long time ago', { asOf: '2024-01-01' })).rejects.toThrow(ToolError);
    expect((await run('')).output).toBe('');
  });
});
