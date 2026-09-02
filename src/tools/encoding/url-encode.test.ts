import { describe, it, expect } from 'vitest';
import tool from './url-encode.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string };

describe('url-encode', () => {
  it('encodes a component', () => {
    expect(run('a b&c=d').output).toBe('a%20b%26c%3Dd');
  });
  it('whole-URL scope keeps structure', () => {
    expect(run('https://x.io/a b?q=1&r=2', { scope: 'full' }).output).toBe(
      'https://x.io/a%20b?q=1&r=2',
    );
  });
  it('decodes a component', () => {
    expect(run('caf%C3%A9%20%26%20cr%C3%A8me', { mode: 'decode' }).output).toBe('café & crème');
  });
  it('round-trips', () => {
    const s = 'Ω≈ç√∫˜µ ?&=#';
    expect(run(run(s).output, { mode: 'decode' }).output).toBe(s);
  });
  it('optionally treats + as space when decoding', () => {
    expect(run('a+b', { mode: 'decode', plusSpace: true }).output).toBe('a b');
    expect(run('a+b', { mode: 'decode', plusSpace: false }).output).toBe('a+b');
  });
  it('throws on malformed input', () => {
    expect(() => run('%', { mode: 'decode' })).toThrow(/percent-encoding/i);
  });
  it('empty input', () => {
    expect(run('').output).toBe('');
  });
});
