import { describe, it, expect } from 'vitest';
import tool from './unicode-escape.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string };

describe('unicode-escape', async () => {
  it('escapes non-ASCII to \\uXXXX by default', async () => {
    expect((await run('café')).output).toBe('caf\\u00E9');
  });
  it('escapes astral chars as a surrogate pair (JS style)', async () => {
    expect((await run('😀')).output).toBe('\\uD83D\\uDE00');
  });
  it('python style uses \\U for astral', async () => {
    expect((await run('😀', { style: 'python' })).output).toBe('\\U0001F600');
  });
  it('U+ style', async () => {
    expect((await run('é', { style: 'unicode-plus' })).output).toBe('U+00E9');
  });
  it('all-characters mode', async () => {
    expect((await run('AB', { which: 'all' })).output).toBe('\\u0041\\u0042');
  });
  it('unescapes mixed forms', async () => {
    expect(
      (await run('caf\\u00e9 \\u{1F600} A\\x42 U+0043 &#x44; &#69;', { mode: 'unescape' })).output,
    ).toBe('café 😀 AB C D E');
  });
  it('round-trips emoji', async () => {
    const s = 'hi 🌍 café';
    const escaped = (await run(s)).output;
    expect((await run(escaped, { mode: 'unescape' })).output).toBe(s);
  });
  it('empty input', async () => {
    expect((await run('')).output).toBe('');
  });
});
