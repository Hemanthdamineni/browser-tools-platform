import { describe, it, expect } from 'vitest';
import tool from './base58.tool';
import { ToolError } from '@/lib/types';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string };

describe('base58', () => {
  it('encodes known values (Bitcoin alphabet)', () => {
    expect(run('Hello World!').output).toBe('2NEpo7TZRRrLZSi2U');
    expect(run('hello').output).toBe('Cn8eVZg');
  });

  it('decodes known values', () => {
    expect(run('2NEpo7TZRRrLZSi2U', { mode: 'decode' }).output).toBe('Hello World!');
    expect(run('Cn8eVZg', { mode: 'decode' }).output).toBe('hello');
  });

  it('preserves leading zero bytes as leading "1"s', () => {
    expect(run('\x00', { mode: 'encode' }).output).toBe('1');
    expect(run('\x00\x00a', { mode: 'encode' }).output).toBe('112g');
    expect(run('112g', { mode: 'decode' }).output).toBe('\x00\x00a');
  });

  it('round-trips UTF-8 text', () => {
    const s = 'héllo — 世界 🚀';
    expect(run(run(s, { mode: 'encode' }).output, { mode: 'decode' }).output).toBe(s);
  });

  it('empty input → empty output for both modes', () => {
    expect(run('', { mode: 'encode' }).output).toBe('');
    expect(run('', { mode: 'decode' }).output).toBe('');
  });

  it('throws on an invalid character when decoding', () => {
    expect(() => run('0OIl', { mode: 'decode' })).toThrow(ToolError);
    expect(() => run('abc def', { mode: 'decode' })).toThrow(/not a valid Base58 character/i);
  });
});
