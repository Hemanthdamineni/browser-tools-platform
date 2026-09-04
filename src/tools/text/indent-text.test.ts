import { describe, it, expect } from 'vitest';
import tool from './indent-text.tool';

type Opts = Record<string, string | number | boolean>;
const run = (text: string, options: Opts = {}) =>
  tool.run({ text, options }) as {
    output: string;
    stats?: Record<string, string | number>;
  };

describe('indent-text', () => {
  it('indents every line by two spaces by default', () => {
    expect(run('a\nb', { mode: 'indent' }).output).toBe('  a\n  b');
  });

  it('indents with a single tab', () => {
    expect(run('a\nb', { mode: 'indent', unit: 'tabs', count: 1 }).output).toBe('\ta\n\tb');
  });

  it('honours a custom unit count', () => {
    expect(run('a', { mode: 'indent', count: 4 }).output).toBe('    a');
  });

  it('skips blank lines when skipBlank is on (default)', () => {
    expect(run('a\n\nb', { mode: 'indent' }).output).toBe('  a\n\n  b');
  });

  it('indents blank lines when skipBlank is off', () => {
    expect(run('a\n\nb', { mode: 'indent', skipBlank: false }).output).toBe('  a\n  \n  b');
  });

  it('dedents up to the requested number of spaces', () => {
    expect(run('    a\n  b\nc', { mode: 'dedent', count: 2 }).output).toBe('  a\nb\nc');
  });

  it('dedents tabs', () => {
    expect(run('\t\t\ta', { mode: 'dedent', unit: 'tabs', count: 2 }).output).toBe('\ta');
  });

  it('dedent leaves blank lines untouched', () => {
    expect(run('    a\n\n    b', { mode: 'dedent', count: 4 }).output).toBe('a\n\nb');
  });

  it('empty input → empty output', () => {
    expect(run('').output).toBe('');
  });

  it('throws ToolError on an out-of-range count', () => {
    expect(() => run('a', { mode: 'indent', count: 0 })).toThrow(/between 1 and 16/i);
  });
});
