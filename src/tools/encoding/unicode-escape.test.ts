import { describe, it, expect } from 'vitest';
import tool from './unicode-escape.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string };

describe('unicode-escape', () => {
  it('escapes non-ASCII to \\uXXXX by default', () => {
    expect(run('café').output).toBe('caf\\u00E9');
  });
  it('escapes astral chars as a surrogate pair (JS style)', () => {
    expect(run('😀').output).toBe('\\uD83D\\uDE00');
  });
  it('python style uses \\U for astral', () => {
    expect(run('😀', { style: 'python' }).output).toBe('\\U0001F600');
  });
  it('U+ style', () => {
    expect(run('é', { style: 'unicode-plus' }).output).toBe('U+00E9');
  });
  it('all-characters mode', () => {
    expect(run('AB', { which: 'all' }).output).toBe('\\u0041\\u0042');
  });
  it('unescapes mixed forms', () => {
    expect(
      run('caf\\u00e9 \\u{1F600} A\\x42 U+0043 &#x44; &#69;', { mode: 'unescape' }).output,
    ).toBe('café 😀 AB C D E');
  });
  it('round-trips emoji', () => {
    const s = 'hi 🌍 café';
    expect(run(run(s).output, { mode: 'unescape' }).output).toBe(s);
  });
  it('empty input', () => {
    expect(run('').output).toBe('');
  });
});
