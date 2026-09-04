import { describe, it, expect } from 'vitest';
import tool from './text-repeat.tool';

type Opts = Record<string, string | number | boolean>;
const run = (text: string, options: Opts = {}) =>
  tool.run({ text, options }) as {
    output: string;
    stats?: Record<string, string | number>;
  };

describe('text-repeat', () => {
  it('repeats with no separator', () => {
    expect(run('ab', { count: 3, separator: 'none' }).output).toBe('ababab');
  });

  it('defaults to 10 copies joined by newlines', () => {
    expect(run('x').output).toBe('x\nx\nx\nx\nx\nx\nx\nx\nx\nx');
  });

  it('joins with a space', () => {
    expect(run('x', { count: 3, separator: 'space' }).output).toBe('x x x');
  });

  it('joins with a comma', () => {
    expect(run('x', { count: 3, separator: 'comma' }).output).toBe('x,x,x');
  });

  it('joins with a custom separator', () => {
    expect(run('x', { count: 3, separator: 'custom', custom: ' | ' }).output).toBe('x | x | x');
  });

  it('treats an empty custom separator as a direct join', () => {
    expect(run('x', { count: 3, separator: 'custom' }).output).toBe('xxx');
  });

  it('empty input → empty output', () => {
    expect(run('').output).toBe('');
  });

  it('reports the total length in stats', () => {
    expect(run('ab', { count: 3, separator: 'none' }).stats).toEqual({
      copies: 3,
      'total length': 6,
    });
  });

  it('throws ToolError when the output would exceed the size cap', () => {
    expect(() => run('a'.repeat(1000), { count: 100000, separator: 'none' })).toThrow(
      /Output too large/i,
    );
  });

  it('throws ToolError on a count below 1', () => {
    expect(() => run('x', { count: 0 })).toThrow(/at least 1/i);
  });
});
