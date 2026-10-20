import { describe, it, expect } from 'vitest';
import tool from './loan-calculator.tool';
import { ToolError } from '@/lib/types';

const run = async (options: Record<string, string | number | boolean> = {}) =>
  await tool.run({ text: '', options });
const table = async (options: Record<string, string | number | boolean> = {}) =>
  JSON.parse((await run(options)).output) as { rows: string[][] };
const cell = (rows: string[][], label: string) => rows.find((r) => r[0] === label)![1]!;

describe('loan-calculator', () => {
  it('computes the monthly payment for a fixed-rate loan', async () => {
    const { rows } = await table({ principal: 100000, annualRatePercent: 6, years: 30 });
    expect(cell(rows, 'Monthly payment')).toBe('599.55');
    expect(cell(rows, 'Number of payments')).toBe('360');
  });
  it('handles a zero interest rate', async () => {
    const { rows } = await table({ principal: 1200, annualRatePercent: 0, years: 1 });
    expect(cell(rows, 'Monthly payment')).toBe('100.00');
    expect(cell(rows, 'Total interest')).toBe('0.00');
  });
  it('shows savings for an extra monthly payment', async () => {
    const { rows } = await table({
      principal: 100000,
      annualRatePercent: 6,
      years: 30,
      extraMonthly: 100,
    });
    expect(Number(cell(rows, 'Number of payments'))).toBeLessThan(360);
    expect(Number(cell(rows, 'Interest saved'))).toBeGreaterThan(0);
  });
  it('rejects non-positive principal and term', async () => {
    await expect(run({ principal: 0 })).rejects.toThrow(ToolError);
    await expect(run({ years: 0 })).rejects.toThrow(ToolError);
    await expect(run({ principal: -5 })).rejects.toThrow(ToolError);
  });
});
