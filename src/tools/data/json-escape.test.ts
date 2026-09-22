import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './json-escape.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string };

describe('json-escape', async () => {
  it('escapes text into a quoted JSON string literal', async () => {
    expect((await run('he said "hi"\ntab\there')).output).toBe('"he said \\"hi\\"\\ntab\\there"');
  });

  it('escape wraps plain text in quotes', async () => {
    expect((await run('plain')).output).toBe('"plain"');
  });

  it('unescapes a JSON string literal', async () => {
    expect((await run('"line1\\nline2"', { mode: 'unescape' })).output).toBe('line1\nline2');
  });

  it('unescape adds surrounding quotes when missing', async () => {
    expect((await run('a\\tb', { mode: 'unescape' })).output).toBe('a\tb');
  });

  it('escape then unescape round-trips', async () => {
    const original = 'quote " backslash \\ newline \n snowman ☃';
    const escaped = (await run(original, { mode: 'escape' })).output;
    expect((await run(escaped, { mode: 'unescape' })).output).toBe(original);
  });

  it('throws ToolError on an unterminated string literal', async () => {
    expect(run('"unterminated', { mode: 'unescape' })).rejects.toThrow(ToolError);
  });

  it('throws ToolError when the text is not a valid string literal', async () => {
    expect(run('{"a":1}', { mode: 'unescape' })).rejects.toThrow(ToolError);
  });

  it('empty input returns empty output in both modes', async () => {
    expect((await run('', { mode: 'escape' })).output).toBe('');
    expect((await run('', { mode: 'unescape' })).output).toBe('');
  });
});
