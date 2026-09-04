import { describe, it, expect } from 'vitest';
import tool from './number-base.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string; stats?: Record<string, string | number> };

describe('number-base', () => {
  it('converts decimal to hex by default', () => {
    expect(run('255').output).toBe('ff');
  });

  it('honours fromBase and toBase', () => {
    expect(run('255', { fromBase: 10, toBase: 2 }).output).toBe('11111111');
    expect(run('11111111', { fromBase: 2, toBase: 10 }).output).toBe('255');
    expect(run('z', { fromBase: 36, toBase: 10 }).output).toBe('35');
  });

  it('accepts 0x / 0o / 0b prefixes overriding fromBase', () => {
    expect(run('0xFF', { fromBase: 10, toBase: 10 }).output).toBe('255');
    expect(run('0o17', { fromBase: 10, toBase: 10 }).output).toBe('15');
    expect(run('0b1010', { fromBase: 10, toBase: 10 }).output).toBe('10');
  });

  it('strips underscores, spaces and commas', () => {
    expect(run('1_000', { fromBase: 10, toBase: 16 }).output).toBe('3e8');
    expect(run('1 000 000', { fromBase: 10, toBase: 10 }).output).toBe('1000000');
  });

  it('handles a leading minus sign', () => {
    expect(run('-10', { fromBase: 10, toBase: 2 }).output).toBe('-1010');
  });

  it('adds a prefix when addPrefix is on', () => {
    expect(run('255', { fromBase: 10, toBase: 16, addPrefix: true }).output).toBe('0xff');
    expect(run('10', { fromBase: 10, toBase: 8, addPrefix: true }).output).toBe('0o12');
    expect(run('5', { fromBase: 10, toBase: 2, addPrefix: true }).output).toBe('0b101');
    expect(run('35', { fromBase: 10, toBase: 36, addPrefix: true }).output).toBe('z');
  });

  it('groups output digits by 4 when groupDigits is on', () => {
    expect(run('1048575', { fromBase: 10, toBase: 16, groupDigits: true }).output).toBe('f ffff');
    expect(run('255', { fromBase: 10, toBase: 2, groupDigits: true }).output).toBe('1111 1111');
  });

  it('keeps arbitrary precision with BigInt', () => {
    const big = '123456789012345678901234567890';
    expect(run(big, { fromBase: 10, toBase: 16 }).output).toBe(BigInt(big).toString(16));
  });

  it('exposes bin/oct/dec/hex in stats', () => {
    const stats = run('255', { fromBase: 10, toBase: 10 }).stats!;
    expect(stats.binary).toBe('11111111');
    expect(stats.octal).toBe('377');
    expect(stats.decimal).toBe('255');
    expect(stats.hex).toBe('ff');
  });

  it('throws ToolError on a digit invalid for the base', () => {
    expect(() => run('2', { fromBase: 2, toBase: 10 })).toThrow(/not a valid digit/i);
    expect(() => run('g', { fromBase: 16, toBase: 10 })).toThrow(/not a valid digit/i);
  });

  it('empty input gives empty output', () => {
    expect(run('').output).toBe('');
    expect(run('   ').output).toBe('');
  });
});
