import { describe, it, expect } from 'vitest';
import tool from './text-repeat.tool';

type Opts = Record<string, string | number | boolean>;
const run = async (text: string, options: Opts = {}) =>
  (await tool.run({ text, options })) as {
    output: string;
    stats?: Record<string, string | number>;
  };

describe('text-repeat', async () => {
  it('repeats with no separator', async () => {
    expect((await run('ab', { count: 3, separator: 'none' })).output).toBe('ababab');
  });

  it('defaults to 10 copies joined by newlines', async () => {
    expect((await run('x')).output).toBe('x\nx\nx\nx\nx\nx\nx\nx\nx\nx');
  });

  it('joins with a space', async () => {
    expect((await run('x', { count: 3, separator: 'space' })).output).toBe('x x x');
  });

  it('joins with a comma', async () => {
    expect((await run('x', { count: 3, separator: 'comma' })).output).toBe('x,x,x');
  });

  it('joins with a custom separator', async () => {
    expect((await run('x', { count: 3, separator: 'custom', custom: ' | ' })).output).toBe(
      'x | x | x',
    );
  });

  it('treats an empty custom separator as a direct join', async () => {
    expect((await run('x', { count: 3, separator: 'custom' })).output).toBe('xxx');
  });

  it('empty input → empty output', async () => {
    expect((await run('')).output).toBe('');
  });

  it('reports the total length in stats', async () => {
    const r = await run('ab', { count: 3, separator: 'none' });
    expect(r.stats).toEqual({
      copies: 3,
      'total length': 6,
    });
  });

  it('handles large counts without artificial limits', async () => {
    const r = await run('a', { count: 10000, separator: 'none' });
    expect(r.output).toHaveLength(10000);
  });

  it('throws ToolError on a count below 1', async () => {
    await expect(run('x', { count: 0 })).rejects.toThrow(/at least 1/i);
  });
});
