import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './csv-transpose.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as {
    output: string;
    language?: string;
    stats?: Record<string, number>;
  };

describe('csv-transpose', () => {
  it('swaps rows and columns', async () => {
    const result = await run('name,age\nAda,36\nLinus,54');
    expect(result.output).toBe('name,Ada,Linus\nage,36,54');
    expect(result.stats).toEqual({ rows: 2, columns: 3 });
    expect(result.language).toBe('csv');
  });

  it('handles quoted delimiters, escaped quotes, and embedded newlines', async () => {
    const result = await run('key,note\n1,"said ""hello"",\nthen left"');
    expect(result.output).toBe('key,1\nnote,"said ""hello"",\nthen left"');
  });

  it('supports CRLF and all explicit delimiters', async () => {
    expect((await run('a;b\r\n1;2', { delimiter: 'semicolon' })).output).toBe('a;1\nb;2');
    expect((await run('a\tb\n1\t2', { delimiter: 'tab' })).output).toBe('a\t1\nb\t2');
    expect((await run('a|b\n1|2', { delimiter: 'pipe' })).output).toBe('a|1\nb|2');
  });

  it('preserves and escapes values containing quotes, line breaks, or trailing spaces', async () => {
    const result = await run('a,b\n"x,y"," padded "');
    expect(result.output).toBe('a,"x,y"\nb," padded "');
    expect((await run('a|b\n"x,y"|z', { delimiter: 'pipe' })).output).toBe('a|x,y\nb|z');
  });

  it('pads ragged rows with empty cells', async () => {
    expect((await run('a,b,c\n1,2\n3')).output).toBe('a,1,3\nb,2,\nc,,');
  });

  it('returns empty output for blank input and handles a trailing newline', async () => {
    expect((await run('  ')).output).toBe('');
    expect((await run('a,b\n1,2\n')).output).toBe('a,1\nb,2');
  });

  it('supports a single-column and a single-row input', async () => {
    expect((await run('a\nb\nc')).output).toBe('a,b,c');
    expect((await run('a,b,c')).output).toBe('a\nb\nc');
  });

  it('reports malformed quoting as a user-facing error', async () => {
    await expect(run('a,b\n"open')).rejects.toThrow(ToolError);
    await expect(run('a,b\nva"lue,2')).rejects.toThrow(ToolError);
    await expect(run('a,b\n"ok"x,2')).rejects.toThrow(ToolError);
  });

  it('processes a large rectangular table', async () => {
    const input = ['a,b', ...Array.from({ length: 5000 }, (_, i) => `${i},${i + 1}`)].join('\n');
    const result = await run(input);
    expect(result.output.split('\n')).toHaveLength(2);
    expect(result.output.startsWith('a,0,1,')).toBe(true);
  });
});
