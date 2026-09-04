import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './remove-empty-lines.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string; stats?: Record<string, string | number> };

describe('remove-empty-lines', () => {
  it('remove-all drops empty and whitespace-only lines (default)', () => {
    const r = run('one\n\n\ntwo\n   \nthree');
    expect(r.output).toBe('one\ntwo\nthree');
    expect(r.stats?.['lines removed']).toBe(3);
  });

  it('remove-all removes every line when all are blank', () => {
    expect(run('\n \n\t\n').output).toBe('');
  });

  it('collapse reduces runs of blank lines to a single blank line', () => {
    const r = run('one\n\n\n\ntwo\n\n\nthree', { mode: 'collapse' });
    expect(r.output).toBe('one\n\ntwo\n\nthree');
    expect(r.stats?.['lines removed']).toBe(3);
  });

  it('collapse leaves single blank lines untouched', () => {
    expect(run('a\n\nb', { mode: 'collapse' }).output).toBe('a\n\nb');
  });

  it('collapse also collapses a leading blank run', () => {
    expect(run('\n\n\na', { mode: 'collapse' }).output).toBe('\na');
  });

  it('trim-trailing removes only trailing blank lines', () => {
    const r = run('one\n\ntwo\n\n\n', { mode: 'trim-trailing' });
    expect(r.output).toBe('one\n\ntwo');
    expect(r.stats?.['lines removed']).toBe(3);
  });

  it('trim-trailing keeps interior and leading blanks', () => {
    expect(run('\na\n\nb', { mode: 'trim-trailing' }).output).toBe('\na\n\nb');
  });

  it('empty input returns empty output', () => {
    expect(run('').output).toBe('');
  });

  it('unknown mode falls back to remove-all behaviour', () => {
    expect(run('a\n\nb', { mode: 'nonsense' }).output).toBe('a\nb');
  });

  it('is exported as a module without throwing ToolError on valid input', () => {
    expect(() => run('a\nb')).not.toThrow(ToolError);
  });
});
