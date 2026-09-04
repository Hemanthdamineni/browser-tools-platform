import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './backslash-escape.tool';

const call = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  call(text, options).output;

describe('backslash-escape', () => {
  it('empty input → empty output', () => {
    expect(run('')).toBe('');
    expect(run('', { mode: 'unescape' })).toBe('');
  });

  it('escapes tab and newline to short forms (default mode)', () => {
    expect(run('a\tb\nc')).toBe('a\\tb\\nc');
  });

  it('doubles a real backslash', () => {
    expect(run('a\\b')).toBe('a\\\\b');
  });

  it('escapes NUL as \\0 and other C0 controls as \\xNN', () => {
    expect(run('\x00')).toBe('\\0');
    expect(run('\x07')).toBe('\\x07');
    expect(run('\x7f')).toBe('\\x7f');
  });

  it('escapes format characters as \\uNNNN', () => {
    expect(run('a\u200bb')).toBe('a\\u200bb');
  });

  it('leaves ordinary letters, punctuation and spaces alone', () => {
    expect(run('é世 ok!')).toBe('é世 ok!');
  });

  it('unescapes the common sequences', () => {
    expect(run('\\n\\t\\x41\\u0042', { mode: 'unescape' })).toBe('\n\tAB');
    expect(run('\\0', { mode: 'unescape' })).toBe('\x00');
    expect(run('a\\\\b', { mode: 'unescape' })).toBe('a\\b');
  });

  it('unescapes a \\u{…} code point', () => {
    expect(run('\\u{1F600}', { mode: 'unescape' })).toBe('\u{1f600}');
  });

  it('drops the backslash of an unknown escape and reports it', () => {
    const res = call('\\q\\w x', { mode: 'unescape' });
    expect(res.output).toBe('qw x');
    expect(res.notes?.[0]).toMatch(/\\q, \\w/);
  });

  it('throws ToolError on a code point above U+10FFFF', () => {
    expect(() => run('\\u{110000}', { mode: 'unescape' })).toThrow(ToolError);
  });

  it('throws ToolError on a non-hex \\u{…} body', () => {
    expect(() => run('\\u{XYZ}', { mode: 'unescape' })).toThrow(ToolError);
  });

  it('throws ToolError on an unterminated \\u{…} escape', () => {
    expect(() => run('\\u{1F600', { mode: 'unescape' })).toThrow(ToolError);
  });

  it('round-trips control-heavy text', () => {
    const original = 'A\tB\nC\x01\x07\u200b\\end';
    expect(run(run(original), { mode: 'unescape' })).toBe(original);
  });

  it('reports mode in stats', () => {
    const res = tool.run({ text: 'x', options: { mode: 'escape' } }) as {
      stats?: Record<string, string | number>;
    };
    expect(res.stats?.mode).toBe('escape');
  });
});
