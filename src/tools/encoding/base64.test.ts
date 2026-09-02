import { describe, it, expect } from 'vitest';
import tool from './base64.tool';

type Opts = Record<string, string | number | boolean>;
const enc = (text: string, options: Opts = {}) =>
  tool.run({ text, options: { mode: 'encode', ...options } }) as { output: string };
const dec = (text: string, options: Opts = {}) =>
  tool.run({ text, options: { mode: 'decode', ...options } }) as {
    output: string;
    notes?: string[];
  };

describe('base64', () => {
  it('encodes ASCII', () => {
    expect(enc('hello world').output).toBe('aGVsbG8gd29ybGQ=');
  });

  it('decodes ASCII', () => {
    expect(dec('aGVsbG8gd29ybGQ=').output).toBe('hello world');
  });

  it('round-trips UTF-8 / emoji', () => {
    const s = 'I ❤ Toolbench — çà et là';
    expect(dec(enc(s).output).output).toBe(s);
  });

  it('produces URL-safe output without padding', () => {
    const out = enc('<<???>>', { urlSafe: true }).output;
    expect(out).not.toMatch(/[+/=]/);
    expect(dec(out).output).toBe('<<???>>');
  });

  it('accepts URL-safe input on decode', () => {
    const std = enc('subjects?_d=1').output;
    const url = std.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(dec(url).output).toBe('subjects?_d=1');
  });

  it('ignores whitespace / newlines when decoding', () => {
    expect(dec('aGVs\nbG8g\td29ybGQ=').output).toBe('hello world');
  });

  it('wraps at 76 chars when asked', () => {
    const out = enc('x'.repeat(120), { wrap: true }).output;
    expect(out.split('\n')[0]).toHaveLength(76);
  });

  it('returns empty for empty input', () => {
    expect(enc('').output).toBe('');
    expect(dec('').output).toBe('');
  });

  it('throws a ToolError on invalid base64', () => {
    expect(() => dec('not*valid*base64')).toThrow(/valid Base64/i);
  });

  it('meta id matches filename', () => {
    expect(tool.meta.id).toBe('base64');
  });
});
