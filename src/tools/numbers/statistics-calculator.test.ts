import { describe, expect, it } from 'vitest';
import tool from './statistics-calculator.tool';

type Result = { output: string; render?: string; stats?: Record<string, string | number | null>; notes?: string[] };
type Table = { headers: string[]; rows: [string, string][] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const table = (r: Result) => JSON.parse(r.output) as Table;
const get = async (text: string, key: string, options: Record<string, string | number | boolean> = {}) =>
  table(await run(text, options)).rows.find((row) => row[0] === key)?.[1];

describe('statistics-calculator', () => {
  it('computes the classic textbook dataset', async () => {
    const options = { spread: 'population', decimals: 4 };
    expect(await get('2, 4, 4, 4, 5, 5, 7, 9', 'Count (n)', options)).toBe('8');
    expect(await get('2, 4, 4, 4, 5, 5, 7, 9', 'Sum', options)).toBe('40');
    expect(await get('2, 4, 4, 4, 5, 5, 7, 9', 'Mean (arithmetic)', options)).toBe('5');
    expect(await get('2, 4, 4, 4, 5, 5, 7, 9', 'Median', options)).toBe('4.5');
    expect(await get('2, 4, 4, 4, 5, 5, 7, 9', 'Variance', options)).toBe('4');
    expect(await get('2, 4, 4, 4, 5, 5, 7, 9', 'Standard deviation', options)).toBe('2');
  });

  it('uses the sample formula by default', async () => {
    expect(await get('2, 4, 4, 4, 5, 5, 7, 9', 'Variance')).toBe('4.5714');
    expect(await get('2, 4, 4, 4, 5, 5, 7, 9', 'Standard deviation')).toBe('2.1381');
  });

  it('finds quartiles, IQR and fences by linear interpolation', async () => {
    expect(await get('2, 4, 4, 4, 5, 5, 7, 9', 'Q1 (first quartile)')).toBe('4');
    expect(await get('2, 4, 4, 4, 5, 5, 7, 9', 'Q3 (third quartile)')).toBe('5.5');
    expect(await get('2, 4, 4, 4, 5, 5, 7, 9', 'IQR')).toBe('1.5');
  });

  it('detects Tukey outliers and reports fences', async () => {
    const result = await run('1 2 3 4 5 100');
    const rows = table(result).rows;
    expect(rows.find((r) => r[0] === 'Outliers (Tukey)')?.[1]).toBe('100');
    expect(rows.find((r) => r[0] === 'Upper fence (Q3 + 1.5*IQR)')?.[1]).toBe('8.5');
    expect(rows.find((r) => r[0] === 'Lower fence (Q1 - 1.5*IQR)')?.[1]).toBe('-1.5');
    expect(result.notes?.join(' ')).toMatch(/outlier/i);
  });

  it('reports multimodal and absent modes', async () => {
    expect(await get('2 4 4 4 5 5 7 9', 'Mode')).toBe('4');
    expect(await get('1 2 2 3 3', 'Mode')).toBe('2, 3');
    expect(await get('1 2 3', 'Mode')).toBe('none');
  });

  it('parses commas, semicolons, newlines and scientific notation', async () => {
    expect(await get('1, 2; 3\n4', 'Count (n)')).toBe('4');
    expect(await get('1, 2; 3\n4', 'Sum')).toBe('10');
    expect(await get('-2.5 1e3', 'Sum')).toBe('997.5');
    expect(await get('-2.5 1e3', 'Minimum')).toBe('-2.5');
  });

  it('handles thousand separators inside a token', async () => {
    expect(await get('1,234 2,000', 'Sum')).toBe('3234');
  });

  it('counts and ignores non-numeric tokens', async () => {
    const result = await run('1 2 abc 3 def');
    expect(await get('1 2 abc 3 def', 'Count (n)')).toBe('3');
    expect(result.notes?.join(' ')).toMatch(/2 non-numeric tokens were ignored/i);
  });

  it('computes geometric and harmonic means for positive data', async () => {
    expect(await get('1 2 4', 'Geometric mean')).toBe('2');
    expect(await get('1 2 4', 'Harmonic mean')).toBe('1.7143');
  });

  it('reports n/a for geometric and harmonic means with non-positive values', async () => {
    expect(await get('-1 2 4', 'Geometric mean')).toBe('n/a');
    expect(await get('0 2 4', 'Harmonic mean')).toBe('n/a');
  });

  it('reports n/a for sample spread with a single value', async () => {
    const result = await run('5');
    const rows = table(result).rows;
    expect(rows.find((r) => r[0] === 'Variance')?.[1]).toBe('n/a');
    expect(rows.find((r) => r[0] === 'Standard deviation')?.[1]).toBe('n/a');
    expect(rows.find((r) => r[0] === 'Mean (arithmetic)')?.[1]).toBe('5');
  });

  it('respects the decimals option', async () => {
    expect(await get('1 2 4', 'Mean (arithmetic)', { decimals: 6 })).toBe('2.333333');
    expect(await get('1 2 4', 'Mean (arithmetic)', { decimals: 0 })).toBe('2');
  });

  it('keeps significant trailing zeros with small precision', async () => {
    expect(await get('100 200', 'Sum', { decimals: 0 })).toBe('300');
    expect(await get('10 20', 'Mean (arithmetic)', { decimals: 1 })).toBe('15');
  });

  it('exposes the exclusive quartile method', async () => {
    const excl = await get('1 2 3 4 5 6 7 8', 'Q1 (first quartile)', { quartiles: 'exclusive' });
    const incl = await get('1 2 3 4 5 6 7 8', 'Q1 (first quartile)', { quartiles: 'inclusive' });
    expect(incl).toBe('2.75');
    expect(excl).toBe('2.25');
  });

  it('computes spread and coefficient of variation', async () => {
    const result = await run('2, 4, 4, 4, 5, 5, 7, 9', { spread: 'population' });
    const rows = table(result).rows;
    expect(rows.find((r) => r[0] === 'Range')?.[1]).toBe('7');
    expect(rows.find((r) => r[0] === 'Coefficient of variation')?.[1]).toBe('40%');
    expect(Number(result.stats?.n)).toBe(8);
    expect(Number(result.stats?.mean)).toBe(5);
    expect(Number(result.stats?.sd)).toBe(2);
  });

  it('reports notes about the chosen formulas', async () => {
    const result = await run('1 2 3', { spread: 'population' });
    const joined = result.notes?.join(' ') ?? '';
    expect(joined).toMatch(/population formula/i);
    const mixed = await run('-1 2 4');
    expect(mixed.notes?.join(' ')).toMatch(/positive/i);
  });

  it('rejects blank input and input without numbers', async () => {
    await expect(run('   ')).rejects.toThrow(/list of numbers/i);
    await expect(run('abc def')).rejects.toThrow(/no numbers found/i);
  });
});
