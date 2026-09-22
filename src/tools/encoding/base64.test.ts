import { describe, it, expect } from 'vitest';
import tool from './base64.tool';

const enc = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options: { mode: 'encode', ...options } })) as { output: string };
const dec = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options: { mode: 'decode', ...options } })) as {
    output: string;
    notes?: string[];
  };

describe('base64', async () => {
  it('encodes ASCII', async () => {
    expect((await enc('hello world')).output).toBe('aGVsbG8gd29ybGQ=');
  });

  it('decodes ASCII', async () => {
    expect((await dec('aGVsbG8gd29ybGQ=')).output).toBe('hello world');
  });

  it('round-trips UTF-8 / emoji', async () => {
    const s = 'I ❤ Toolbench — çà et là';
    const encoded = (await enc(s)).output;
    expect((await dec(encoded)).output).toBe(s);
  });

  it('produces URL-safe output without padding', async () => {
    const out = (await enc('<<???>>', { urlSafe: true })).output;
    expect(out).not.toMatch(/[+/=]/);
    expect((await dec(out)).output).toBe('<<???>>');
  });

  it('accepts URL-safe input on decode', async () => {
    const std = (await enc('subjects?_d=1')).output;
    const url = std.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect((await dec(url)).output).toBe('subjects?_d=1');
  });

  it('ignores whitespace / newlines when decoding', async () => {
    expect((await dec('aGVs\nbG8g\td29ybGQ=')).output).toBe('hello world');
  });

  it('wraps at 76 chars when asked', async () => {
    const out = (await enc('x'.repeat(120), { wrap: true })).output;
    expect(out.split('\n')[0]).toHaveLength(76);
  });

  it('returns empty for empty input', async () => {
    expect((await enc('')).output).toBe('');
    expect((await dec('')).output).toBe('');
  });

  it('throws a ToolError on invalid base64', async () => {
    expect(dec('not*valid*base64')).rejects.toThrow(/valid Base64/i);
  });

  it('meta id matches filename', async () => {
    expect(tool.meta.id).toBe('base64');
  });
});
