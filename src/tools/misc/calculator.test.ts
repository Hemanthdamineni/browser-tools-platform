import { describe, it, expect } from 'vitest';
import tool from './calculator.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  await tool.run({ text, options });

describe('calculator', () => {
  it('evaluates precedence, parentheses and right-associative powers', async () => {
    expect((await run('2 + 3 * 4')).output).toBe('14');
    expect((await run('(2+3)^2')).output).toBe('25');
    expect((await run('2^3^2')).output).toBe('512');
  });
  it('binds exponentiation tighter than unary minus', async () => {
    // The grammar in `calculator.tool.ts` parses the exponent as a unary/power
    // expression and the base as a postfix expression, so a leading minus
    // applies to the finished power: `-3^2` is `-(3^2)` = -9 (NOT 9).
    expect((await run('-3^2')).output).toBe('-9');
    expect((await run('(-3)^2')).output).toBe('9');
    // The same rule keeps a signed exponent working.
    expect((await run('2^-2')).output).toBe('0.25');
  });
  it('supports the scientific functions the keypad exposes', async () => {
    expect((await run('sin(pi/2)')).output).toBe('1');
    expect((await run('log10(1000)')).output).toBe('3');
    expect((await run('ln(e)')).output).toBe('1');
    expect((await run('sqrt(144)')).output).toBe('12');
    expect((await run('2^10')).output).toBe('1024');
    expect((await run('5!')).output).toBe('120');
    expect((await run('factorial(5)')).output).toBe('120');
    expect((await run('cos(0)')).output).toBe('1');
    expect((await run('cbrt(27)')).output).toBe('3');
  });
  it('supports functions, constants and factorial', async () => {
    expect((await run('sqrt(16)')).output).toBe('4');
    expect((await run('gcd(12, 18)')).output).toBe('6');
  });
  it('supports degrees and precision', async () => {
    expect((await run('sin(90)', { angleMode: 'degrees' })).output).toBe('1');
    expect((await run('1/3', { precision: 3 })).output).toBe('0.333');
  });
  it('ignores thousands separators', async () => {
    expect((await run('1,000 + 2')).output).toBe('1002');
    expect((await run('1_000 + 2')).output).toBe('1002');
  });
  it('accepts the scientific keypad option without changing the maths', async () => {
    expect((await run('sin(pi/2)', { scientific: true })).output).toBe('1');
    expect((await run('2+3*4', { scientific: false })).output).toBe('14');
  });
  it('rejects division by zero, syntax errors, and invalid domains', async () => {
    await expect(run('1/0')).rejects.toThrow(ToolError);
    await expect(run('2 +')).rejects.toThrow(ToolError);
    await expect(run('sqrt(-1)')).rejects.toThrow(ToolError);
    await expect(run('log10(0)')).rejects.toThrow(ToolError);
    await expect(run('unknown(2)')).rejects.toThrow(ToolError);
  });
  it('does not evaluate code and gives empty output for empty input', async () => {
    await expect(run('globalThis')).rejects.toThrow(ToolError);
    await expect(run('Function("return 1")()')).rejects.toThrow(ToolError);
    expect((await run('')).output).toBe('');
  });
  it('rejects functions called with no arguments', async () => {
    await expect(run('sqrt()')).rejects.toThrow(/at least one argument/i);
    await expect(run('abs()')).rejects.toThrow(/at least one argument/i);
  });
  it('rejects results that are not finite numbers', async () => {
    await expect(run('10^400')).rejects.toThrow(/finite/i);
    await expect(run('1/0')).rejects.toThrow(/zero/i);
    await expect(run('sqrt(-4)')).rejects.toThrow(/non-negative/i);
  });
});
