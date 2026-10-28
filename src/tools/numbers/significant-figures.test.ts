import { describe, expect, it } from 'vitest';
import tool from './significant-figures.tool';

type Result = {
  output: string;
  render?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
  warnings?: string[];
};
type Table = { headers: string[]; rows: string[][] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

const table = async (text: string, options: Record<string, string | number | boolean> = {}) => {
  const r = await run(text, options);
  return { r, parsed: JSON.parse(r.output) as Table };
};

const SF = 1;
const DECIMALS = 2;
const SCI = 3;
const ENG = 4;
const VALUE = 5;
const ROUNDED = 6;

describe('significant-figures', () => {
  it('counts the classic 0.00450 example', async () => {
    const { parsed } = await table('0.00450');
    const row = parsed.rows[0] as string[];
    expect(parsed.headers[SF]).toBe('Significant figures');
    expect(row[SF]).toBe('3');
    expect(row[DECIMALS]).toBe('5');
    expect(row[SCI]).toBe('4.50e-3');
    expect(row[ENG]).toBe('4.50e-3');
    expect(row[VALUE]).toBe('0.0045');
  });

  it('treats trailing zeros without a decimal point as insignificant and ambiguous', async () => {
    const { r, parsed } = await table('1200');
    const row = parsed.rows[0] as string[];
    expect(row[SF]).toBe('2');
    expect(row[SCI]).toBe('1.2e3');
    expect(r.notes?.join(' ')).toMatch(/ambiguous/i);
    expect(r.stats?.ambiguous).toBe(1);
  });

  it('counts trailing zeros when a decimal point is present', async () => {
    const { parsed } = await table('1200.');
    const row = parsed.rows[0] as string[];
    expect(row[SF]).toBe('4');
    expect(row[SCI]).toBe('1.200e3');
    expect(row[ENG]).toBe('1.200e3');
  });

  it('handles scientific-notation input and reports engineering form', async () => {
    const { parsed } = await table('1.230e5');
    const row = parsed.rows[0] as string[];
    expect(row[SF]).toBe('4');
    expect(row[DECIMALS]).toBe('3');
    expect(row[SCI]).toBe('1.230e5');
    expect(row[ENG]).toBe('123.0e3');
    expect(row[VALUE]).toBe('123000');
  });

  it('reduces 1000 to a single significant figure', async () => {
    const { r, parsed } = await table('1000');
    expect((parsed.rows[0] as string[])[SF]).toBe('1');
    expect(r.stats?.lowestSigFigs).toBe(1);
  });

  it('ignores leading zeros', async () => {
    const { parsed } = await table('0.1');
    const row = parsed.rows[0] as string[];
    expect(row[SF]).toBe('1');
    expect(row[SCI]).toBe('1e-1');
  });

  it('keeps the sign and precision of a negative value', async () => {
    const { parsed } = await table('-2.50');
    const row = parsed.rows[0] as string[];
    expect(row[SF]).toBe('3');
    expect(row[SCI]).toBe('-2.50e0');
    expect(row[VALUE]).toBe('-2.5');
  });

  it('parses forms without a leading or trailing digit', async () => {
    const leading = await table('.5');
    expect((leading.parsed.rows[0] as string[])[SCI]).toBe('5e-1');
    expect((leading.parsed.rows[0] as string[])[DECIMALS]).toBe('1');
    const trailing = await table('5.');
    expect((trailing.parsed.rows[0] as string[])[SCI]).toBe('5e0');
  });

  it('strips thousands separators', async () => {
    const { parsed } = await table('1,200');
    expect((parsed.rows[0] as string[])[SF]).toBe('2');
  });

  it('treats zero as a special case', async () => {
    const plain = await table('0');
    expect((plain.parsed.rows[0] as string[])[SF]).toBe('1');
    expect((plain.parsed.rows[0] as string[])[SCI]).toBe('0');
    expect(plain.r.notes?.join(' ')).toMatch(/zero is a special case/i);
    const padded = await table('0.000');
    expect((padded.parsed.rows[0] as string[])[SF]).toBe('3');
    expect((padded.parsed.rows[0] as string[])[DECIMALS]).toBe('3');
  });

  it('reports engineering notation with exponents in multiples of three', async () => {
    const { parsed } = await table('1.5e-4');
    expect((parsed.rows[0] as string[])[ENG]).toBe('150e-6');
  });

  it('rounds to a requested number of significant figures', async () => {
    const { r, parsed } = await table('1.23456', { roundTo: 3 });
    expect((parsed.rows[0] as string[])[ROUNDED]).toBe('1.23');
    expect(r.notes?.join(' ')).toMatch(/rounded to 3 significant/i);
    const off = await table('1.23456');
    expect((off.parsed.rows[0] as string[])[ROUNDED]).toBe('n/a');
  });

  it('preserves trailing zeros in a rounded value', async () => {
    const { parsed } = await table('0.0045', { roundTo: 3 });
    expect((parsed.rows[0] as string[])[ROUNDED]).toBe('0.00450');
  });

  it('analyses several numbers on separate lines', async () => {
    const { parsed } = await table('0.00450\n1200\n1200.\n1.230e5');
    expect(parsed.rows).toHaveLength(4);
    expect(parsed.rows.map((row) => row[SF])).toEqual(['3', '2', '4', '4']);
  });

  it('supports a plain-text lines format', async () => {
    const r = await run('0.00450', { format: 'lines' });
    expect(r.render).toBe('code');
    expect(r.output).toContain('3 sf');
    expect(r.output).toContain('4.50e-3');
  });

  it('rejects unreadable input', async () => {
    await expect(run('not a number')).rejects.toThrow(/could not read/i);
    await expect(run('1.2.3')).rejects.toThrow(/could not read/i);
    await expect(run('1e')).rejects.toThrow(/could not read/i);
  });

  it('rejects empty input', async () => {
    await expect(run('')).rejects.toThrow(/paste one number/i);
  });
});
