import { describe, it, expect } from 'vitest';
import tool from './hex.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string };

describe('hex', () => {
  it('encodes with a space separator by default', () => {
    expect(run('Hi').output).toBe('48 69');
  });
  it('encodes with no separator', () => {
    expect(run('Hi', { separator: 'none' }).output).toBe('4869');
  });
  it('encodes uppercase', () => {
    expect(run('Hi', { separator: 'none', uppercase: true }).output).toBe('4869');
    expect(run('\xff', { separator: 'none', uppercase: true }).output).toBe('C3BF');
  });
  it('encodes 0x and \\x forms', () => {
    expect(run('Hi', { separator: '0x' }).output).toBe('0x48 0x69');
    expect(run('Hi', { separator: 'backslash-x' }).output).toBe('\\x48\\x69');
  });
  it('round-trips UTF-8', () => {
    const s = 'héllo — 世界';
    const hex = run(s, { separator: 'none' }).output;
    expect(run(hex, { mode: 'decode' }).output).toBe(s);
  });
  it('decodes ignoring separators and prefixes', () => {
    expect(run('68:65:6c:6c:6f', { mode: 'decode' }).output).toBe('hello');
    expect(run('0x680x65', { mode: 'decode' }).output).toBe('he');
  });
  it('throws on odd-length hex', () => {
    expect(() => run('abc', { mode: 'decode' })).toThrow(/odd number/i);
  });
  it('empty input → empty output', () => {
    expect(run('').output).toBe('');
  });
});
