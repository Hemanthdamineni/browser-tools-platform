import { describe, expect, it } from 'vitest';
import tool from './credit-card-validator.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const table = (r: Result): string[][] => (JSON.parse(r.output) as { headers: string[]; rows: string[][] }).rows;

describe('credit-card-validator', () => {
  it('accepts a valid Visa number and detects the brand', async () => {
    const r = await run('4111 1111 1111 1111');
    expect(r.render).toBe('table');
    const rows = table(r);
    const value = (name: string): string => rows.find((row) => row[0] === name)![1]!;
    expect(value('Brand')).toBe('Visa');
    expect(value('Luhn checksum')).toBe('Pass');
    expect(value('Result')).toBe('Valid');
    expect(value('Length check')).toBe('Pass');
  });

  it('accepts a valid Amex number', async () => {
    const r = await run('3782 822463 10005');
    expect(table(r).find((row) => row[0] === 'Brand')![1]).toBe('American Express');
    expect(table(r).find((row) => row[0] === 'Result')![1]).toBe('Valid');
    expect(table(r).find((row) => row[0] === 'Digits')![1]).toBe('15');
  });

  it('rejects a bad Luhn number (wrong digit)', async () => {
    const r = await run('4111 1111 1111 1112');
    expect(table(r).find((row) => row[0] === 'Luhn checksum')![1]).toBe('Fail');
    expect(table(r).find((row) => row[0] === 'Result')![1]).toBe('Invalid');
  });

  it('flags an invalid length for the brand when strict', async () => {
    const r = await run('411111111111', { strictLength: true });
    const len = table(r).find((row) => row[0] === 'Length check');
    expect(len).toBeDefined();
  });

  it('ignores dashes and spaces, rejects letters', async () => {
    await expect(run('4aaa 1111')).rejects.toThrow(/digits, spaces and dashes/i);
    const r = await run('4-111-1111-1111-1111');
    expect(table(r).find((row) => row[0] === 'Digits')![1]).toBe('16');
  });

  it('detects Mastercard and unknown brands', async () => {
    const mc = await run('5555 5555 5555 4444');
    expect(table(mc).find((row) => row[0] === 'Brand')![1]).toBe('Mastercard');
    const unknown = await run('1234 5678 9012 3456');
    expect(table(unknown).find((row) => row[0] === 'Brand')![1]).toBe('Unrecognised');
  });

  it('rejects empty input', async () => {
    await expect(run('   ')).rejects.toThrow(/Enter a card number/i);
  });
});
