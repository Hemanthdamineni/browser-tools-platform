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
  it('supports functions, constants and factorial', async () => {
    expect((await run('sqrt(16)')).output).toBe('4');
    expect((await run('sin(pi/2)')).output).toBe('1');
    expect((await run('5!')).output).toBe('120');
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
  it('rejects division by zero, syntax errors, and invalid domains', async () => {
    await expect(run('1/0')).rejects.toThrow(ToolError);
    await expect(run('2 +')).rejects.toThrow(ToolError);
    await expect(run('sqrt(-1)')).rejects.toThrow(ToolError);
    await expect(run('unknown(2)')).rejects.toThrow(ToolError);
  });
  it('does not evaluate code and gives empty output for empty input', async () => {
    await expect(run('globalThis')).rejects.toThrow(ToolError);
    expect((await run('')).output).toBe('');
  });
  it('rejects empty function arguments and non-finite results', async () => {
    await expect(run('sqrt()')).rejects.toThrow(ToolError);
    await expect(run('min()')).rejects.toThrow(ToolError);
    await expect(run('10 * pow(10, 308)')).rejects.toThrow(/finite number/i);
    await expect(run('(-2)^0.5')).rejects.toThrow(/finite number/i);
  });
});
