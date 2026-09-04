import { describe, it, expect } from 'vitest';
import tool from './punycode.tool';
import { ToolError } from '@/lib/types';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options });

describe('punycode', () => {
  it('encodes münchen.de per RFC 3492', () => {
    expect(run('münchen.de').output).toBe('xn--mnchen-3ya.de');
  });

  it('encodes bücher.example', () => {
    expect(run('bücher.example').output).toBe('xn--bcher-kva.example');
  });

  it('encodes a CJK label', () => {
    expect(run('日本語.jp').output).toBe('xn--wgv71a119e.jp');
  });

  it('leaves ASCII-only domains unchanged in both directions', () => {
    expect(run('example.com').output).toBe('example.com');
    expect(run('example.com', { mode: 'to-unicode' }).output).toBe('example.com');
  });

  it('round-trips Unicode → ASCII → Unicode', () => {
    const ascii = run('münchen.de').output;
    expect(run(ascii, { mode: 'to-unicode' }).output).toBe('münchen.de');
  });

  it('handles mixed ASCII and non-ASCII labels', () => {
    expect(run('www.münchen.de').output).toBe('www.xn--mnchen-3ya.de');
  });

  it('throws ToolError on an invalid xn-- label', () => {
    expect(() => run('xn--!!!.de', { mode: 'to-unicode' })).toThrow(ToolError);
    expect(() => run('xn--!!!.de', { mode: 'to-unicode' })).toThrow(/Invalid Punycode label/);
  });

  it('empty input gives empty output', () => {
    expect(run('').output).toBe('');
  });
});
