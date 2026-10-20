import { describe, expect, it } from 'vitest';
import tool from './fraction-simplify.tool';

type Result = { output: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('fraction-simplify', () => {
  it('reduces fractions to lowest terms', async () => {
    expect((await run('12/18')).output.trim()).toBe('2/3');
    expect((await run('8/4')).output.trim()).toBe('2');
    expect((await run('3')).output.trim()).toBe('3');
  });

  it('handles negatives on the numerator', async () => {
    expect((await run('-6/4')).output.trim()).toBe('-3/2');
    expect((await run('6/-4')).output.trim()).toBe('-3/2');
  });

  it('converts decimals to exact fractions', async () => {
    expect((await run('0.75')).output.trim()).toBe('3/4');
    expect((await run('1.25')).output.trim()).toBe('5/4');
    expect((await run('-1.5')).output.trim()).toBe('-3/2');
  });

  it('shows mixed numbers when requested', async () => {
    expect((await run('9/4', { mixedNumber: true })).output.trim()).toBe('2 1/4');
    expect((await run('9/4')).output.trim()).toBe('9/4');
  });

  it('rejects zero denominators and bad input', async () => {
    await expect(run('4/0')).rejects.toThrow(/denominator/i);
    await expect(run('abc')).rejects.toThrow(/not a parseable/i);
    await expect(run('   ')).rejects.toThrow(/enter a fraction/i);
  });
});
