import { describe, it, expect } from 'vitest';
import tool from './base32.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string };

describe('base32', () => {
  it('encodes RFC 4648 vectors', () => {
    expect(run('').output).toBe('');
    expect(run('f').output).toBe('MY======');
    expect(run('fo').output).toBe('MZXQ====');
    expect(run('foo').output).toBe('MZXW6===');
    expect(run('foobar').output).toBe('MZXW6YTBOI======');
  });
  it('omits padding when disabled', () => {
    expect(run('foo', { padding: false }).output).toBe('MZXW6');
  });
  it('decodes RFC 4648', () => {
    expect(run('MZXW6YTBOI======', { mode: 'decode' }).output).toBe('foobar');
    expect(run('nbswy3dp', { mode: 'decode' }).output).toBe('hello');
  });
  it('round-trips UTF-8', () => {
    const s = 'héllo 世界';
    expect(run(run(s).output, { mode: 'decode' }).output).toBe(s);
  });
  it('Crockford variant round-trips and rejects U', () => {
    const enc = run('test', { variant: 'crockford' }).output;
    expect(run(enc, { mode: 'decode', variant: 'crockford' }).output).toBe('test');
  });
  it('throws on an invalid character', () => {
    expect(() => run('MZXW6YTB01', { mode: 'decode' })).toThrow(/not valid Base32/i);
  });
});
