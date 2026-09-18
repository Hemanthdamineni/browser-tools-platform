import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './remove-empty-lines.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) => await tool.run({ text, options }) as { output: string; stats?: Record<string, string | number> };

describe('remove-empty-lines', async () => {
  it('remove-all drops empty and whitespace-only lines (default)', async () => {
    const r = await run('one\n\n\ntwo\n   \nthree');
    expect(r.output).toBe('one\ntwo\nthree');
    expect(r.stats?.['lines removed']).toBe(3);
  });

  it('remove-all removes every line when all are blank', async () => {
    expect((await run('\n \n\t\n')).output).toBe('');
  });

  it('collapse reduces runs of blank lines to a single blank line', async () => {
    const r = await run('one\n\n\n\ntwo\n\n\nthree', { mode: 'collapse' });
    expect(r.output).toBe('one\n\ntwo\n\nthree');
    expect(r.stats?.['lines removed']).toBe(3);
  });

  it('collapse leaves single blank lines untouched', async () => {
    expect((await run('a\n\nb', { mode: 'collapse' })).output).toBe('a\n\nb');
  });

  it('collapse also collapses a leading blank run', async () => {
    expect((await run('\n\n\na', { mode: 'collapse' })).output).toBe('\na');
  });

  it('trim-trailing removes only trailing blank lines', async () => {
    const r = await run('one\n\ntwo\n\n\n', { mode: 'trim-trailing' });
    expect(r.output).toBe('one\n\ntwo');
    expect(r.stats?.['lines removed']).toBe(3);
  });

  it('trim-trailing keeps interior and leading blanks', async () => {
    expect((await run('\na\n\nb', { mode: 'trim-trailing' })).output).toBe('\na\n\nb');
  });

  it('empty input returns empty output', async () => {
    expect((await run('')).output).toBe('');
  });

  it('unknown mode falls back to remove-all behaviour', async () => {
    expect((await run('a\n\nb', { mode: 'nonsense' })).output).toBe('a\nb');
  });

  it('is exported as a module without throwing ToolError on valid input', async () => {
    expect(() => run('a\nb')).not.toThrow(ToolError);
  });
});
