import { describe, it, expect } from 'vitest';
import tool from './line-numbers.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string; stats?: Record<string, string | number> };

describe('line-numbers', () => {
  it('numbers each line from 1 with a dot-space separator by default', () => {
    const r = run('alpha\nbeta\ngamma');
    expect(r.output).toBe('1. alpha\n2. beta\n3. gamma');
    expect(r.stats?.['line count']).toBe(3);
  });

  it('honours a custom start number', () => {
    expect(run('alpha\nbeta\ngamma', { start: 10 }).output).toBe('10. alpha\n11. beta\n12. gamma');
  });

  it('zero-pads to the width of the largest number', () => {
    const text = Array.from({ length: 11 }, (_, i) => String.fromCharCode(97 + i)).join('\n');
    const lines = run(text, { start: 0, zeroPad: true, separator: 'paren' }).output.split('\n');
    expect(lines[0]).toBe('00) a');
    expect(lines[10]).toBe('10) k');
  });

  it('supports the pipe separator', () => {
    expect(run('alpha', { separator: 'pipe' }).output).toBe('1 | alpha');
  });

  it('supports the tab separator', () => {
    expect(run('alpha', { separator: 'tab' }).output).toBe('1\talpha');
  });

  it('supports the paren separator', () => {
    expect(run('alpha', { separator: 'paren' }).output).toBe('1) alpha');
  });

  it('supports the colon separator', () => {
    expect(run('alpha', { separator: 'colon' }).output).toBe('1: alpha');
  });

  it('skipBlank leaves blank lines in place without numbering or advancing the count', () => {
    const r = run('first\n\nthird', { skipBlank: true, separator: 'pipe' });
    expect(r.output).toBe('1 | first\n\n2 | third');
    expect(r.stats?.numbered).toBe(2);
  });

  it('without skipBlank, blank lines are numbered too', () => {
    expect(run('first\n\nthird').output).toBe('1. first\n2. \n3. third');
  });

  it('empty input returns empty output', () => {
    expect(run('').output).toBe('');
  });
});
