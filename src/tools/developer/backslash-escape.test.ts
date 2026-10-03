import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './backslash-escape.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string; notes?: string[] };

describe('backslash-escape', async () => {
  it('empty input → empty output', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('', { mode: 'unescape' })).output).toBe('');
  });

  it('escapes tab and newline to short forms (default mode)', async () => {
    expect((await run('a\tb\nc')).output).toBe('a\\tb\\nc');
  });

  it('doubles a real backslash', async () => {
    expect((await run('a\\b')).output).toBe('a\\\\b');
  });

  it('escapes NUL as \\0 and other C0 controls as \\xNN', async () => {
    expect((await run('\x00')).output).toBe('\\0');
    expect((await run('\x07')).output).toBe('\\x07');
    expect((await run('\x7f')).output).toBe('\\x7f');
  });

  it('escapes format characters as \\uNNNN', async () => {
    expect((await run('a\u200bb')).output).toBe('a\\u200bb');
  });

  it('leaves ordinary letters, punctuation and spaces alone', async () => {
    expect((await run('é世 ok!')).output).toBe('é世 ok!');
  });

  it('unescapes the common sequences', async () => {
    expect((await run('\\n\\t\\x41\\u0042', { mode: 'unescape' })).output).toBe('\n\tAB');
    expect((await run('\\0', { mode: 'unescape' })).output).toBe('\x00');
    expect((await run('a\\\\b', { mode: 'unescape' })).output).toBe('a\\b');
  });

  it('unescapes a \\u{…} code point', async () => {
    expect((await run('\\u{1F600}', { mode: 'unescape' })).output).toBe('\u{1f600}');
  });

  it('drops the backslash of an unknown escape and reports it', async () => {
    const res = await run('\\q\\w x', { mode: 'unescape' });
    expect(res.output).toBe('qw x');
    expect(res.notes?.[0]).toMatch(/\\q, \\w/);
  });

  it('throws ToolError on a code point above U+10FFFF', async () => {
    expect(run('\\u{110000}', { mode: 'unescape' })).rejects.toThrow(ToolError);
  });

  it('throws ToolError on a non-hex \\u{…} body', async () => {
    expect(run('\\u{XYZ}', { mode: 'unescape' })).rejects.toThrow(ToolError);
  });

  it('throws ToolError on an unterminated \\u{…} escape', async () => {
    expect(run('\\u{1F600', { mode: 'unescape' })).rejects.toThrow(ToolError);
  });

  it('round-trips control-heavy text', async () => {
    const original = 'A\tB\nC\x01\x07\u200b\\end';
    expect((await run((await run(original)).output, { mode: 'unescape' })).output).toBe(original);
  });

  it('reports mode in stats', async () => {
    const res = (await tool.run({ text: 'x', options: { mode: 'escape' } })) as {
      stats?: Record<string, string | number>;
    };
    expect(res.stats?.mode).toBe('escape');
  });
});
