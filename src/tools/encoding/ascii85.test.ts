import { describe, it, expect } from 'vitest';
import tool from './ascii85.tool';
import { ToolError } from '@/lib/types';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string };

describe('ascii85', () => {
  it('encodes the Adobe variant with delimiters', () => {
    expect(run('Man is', { mode: 'encode', variant: 'adobe' }).output).toBe('<~9jqo^Bla~>');
    expect(run('Hello', { mode: 'encode', variant: 'adobe' }).output).toBe('<~87cURDZ~>');
  });

  it('encodes the btoa variant without delimiters', () => {
    expect(run('Hello', { mode: 'encode', variant: 'btoa' }).output).toBe('87cURDZ');
  });

  it('uses z for a zero group and y for four spaces (btoa)', () => {
    expect(run('\x00\x00\x00\x00', { mode: 'encode', variant: 'adobe' }).output).toBe('<~z~>');
    expect(run('    ', { mode: 'encode', variant: 'btoa' }).output).toBe('y');
  });

  it('decodes the Adobe and btoa variants', () => {
    expect(run('<~9jqo^Bla~>', { mode: 'decode', variant: 'adobe' }).output).toBe('Man is');
    expect(run('87cURDZ', { mode: 'decode', variant: 'btoa' }).output).toBe('Hello');
    expect(run('<~z~>', { mode: 'decode', variant: 'adobe' }).output).toBe('\x00\x00\x00\x00');
    expect(run('y', { mode: 'decode', variant: 'btoa' }).output).toBe('    ');
  });

  it('decodes Adobe input even without the <~ ~> delimiters', () => {
    expect(run('87cURDZ', { mode: 'decode', variant: 'adobe' }).output).toBe('Hello');
  });

  it('handles the Z85 variant (multiple of 4 bytes)', () => {
    expect(run('test', { mode: 'encode', variant: 'z85' }).output).toBe('By/Jn');
    expect(run('By/Jn', { mode: 'decode', variant: 'z85' }).output).toBe('test');
  });

  it('round-trips UTF-8 text (adobe and btoa)', () => {
    const s = 'héllo — 世界 🚀';
    for (const variant of ['adobe', 'btoa'] as const) {
      const enc = run(s, { mode: 'encode', variant }).output;
      expect(run(enc, { mode: 'decode', variant }).output).toBe(s);
    }
  });

  it('empty input → empty output', () => {
    expect(run('', { mode: 'encode', variant: 'adobe' }).output).toBe('');
    expect(run('', { mode: 'decode', variant: 'z85' }).output).toBe('');
  });

  it('throws when Z85 input is not a multiple of 4 bytes on encode', () => {
    expect(() => run('abc', { mode: 'encode', variant: 'z85' })).toThrow(ToolError);
    expect(() => run('abc', { mode: 'encode', variant: 'z85' })).toThrow(/multiple of 4/i);
  });

  it('throws when Z85 input is not a multiple of 5 chars on decode', () => {
    expect(() => run('abcd', { mode: 'decode', variant: 'z85' })).toThrow(/multiple of 5/i);
  });

  it('throws on a dangling character when decoding Adobe', () => {
    expect(() => run('<~a~>', { mode: 'decode', variant: 'adobe' })).toThrow(/dangling/i);
  });

  it('throws on an out-of-range character when decoding', () => {
    expect(() => run('ab~cd', { mode: 'decode', variant: 'btoa' })).toThrow(
      /not a valid Ascii85 character/i,
    );
  });

  it('throws when an Ascii85 group overflows 32 bits', () => {
    // "uuuuu" is 84*(85^4+85^3+85^2+85+1) = 4437053124 > 2^32-1
    expect(() => run('<~uuuuu~>', { mode: 'decode', variant: 'adobe' })).toThrow(ToolError);
    expect(() => run('<~uuuuu~>', { mode: 'decode', variant: 'adobe' })).toThrow(/out of range/i);
  });

  it('throws when a Z85 group overflows 32 bits', () => {
    // "#####" maps to 84,84,84,84,84 -> same overflow value
    expect(() => run('#####', { mode: 'decode', variant: 'z85' })).toThrow(/out of range/i);
  });
});
