import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './json-escape.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string };

describe('json-escape', () => {
  it('escapes text into a quoted JSON string literal', () => {
    expect(run('he said "hi"\ntab\there').output).toBe('"he said \\"hi\\"\\ntab\\there"');
  });

  it('escape wraps plain text in quotes', () => {
    expect(run('plain').output).toBe('"plain"');
  });

  it('unescapes a JSON string literal', () => {
    expect(run('"line1\\nline2"', { mode: 'unescape' }).output).toBe('line1\nline2');
  });

  it('unescape adds surrounding quotes when missing', () => {
    expect(run('a\\tb', { mode: 'unescape' }).output).toBe('a\tb');
  });

  it('escape then unescape round-trips', () => {
    const original = 'quote " backslash \\ newline \n snowman ☃';
    const escaped = run(original, { mode: 'escape' }).output;
    expect(run(escaped, { mode: 'unescape' }).output).toBe(original);
  });

  it('throws ToolError on an unterminated string literal', () => {
    expect(() => run('"unterminated', { mode: 'unescape' })).toThrow(ToolError);
  });

  it('throws ToolError when the text is not a valid string literal', () => {
    expect(() => run('{"a":1}', { mode: 'unescape' })).toThrow(ToolError);
  });

  it('empty input returns empty output in both modes', () => {
    expect(run('', { mode: 'escape' }).output).toBe('');
    expect(run('', { mode: 'unescape' }).output).toBe('');
  });
});
