import { describe, it, expect } from 'vitest';
import tool from './programmer-calculator.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  await tool.run({ text, options });
const rows = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (JSON.parse((await run(text, options)).output) as { rows: string[][] }).rows;
const get = (rs: string[][], name: string) => rs.find((r) => r[0] === name)![1]!;

describe('programmer-calculator', () => {
  it('calculates bitwise OR and renders multiple bases', async () => {
    const rs = await rows('0xF0 | 0x0F');
    expect(get(rs, 'DEC')).toBe('255');
    expect(get(rs, 'HEX')).toBe('0xFF');
  });
  it('supports shifts and modulo', async () => {
    expect(get(await rows('1 << 4'), 'DEC')).toBe('16');
    expect(get(await rows('5 % 3'), 'DEC')).toBe('2');
  });
  it('applies width masks and signed interpretation', async () => {
    expect(get(await rows('~0', { bits: '8' }), 'DEC')).toBe('255');
    expect(get(await rows('~0', { bits: '8', signed: true }), 'DEC')).toBe('-1');
  });
  it('handles parentheses and operator precedence', async () => {
    expect(get(await rows('(1 + 2) << 3'), 'DEC')).toBe('24');
    expect(get(await rows('1 + 2 * 3'), 'DEC')).toBe('7');
  });
  it('throws on malformed expressions and division by zero', async () => {
    await expect(run('1 +')).rejects.toThrow(ToolError);
    await expect(run('1 / 0')).rejects.toThrow(ToolError);
    await expect(run('1 < 3')).rejects.toThrow(ToolError);
  });
});
