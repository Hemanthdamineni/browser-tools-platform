import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool, { WORDS } from './passphrase.tool';

type Res = { output: string; render?: string; stats?: Record<string, string | number> };
const run = (options: Record<string, string | number | boolean> = {}, text = '') =>
  tool.run({ text, options }) as Res;

describe('passphrase wordlist', () => {
  it('has 1110 unique short lowercase words', () => {
    expect(WORDS).toHaveLength(1110);
    expect(new Set(WORDS).size).toBe(1110);
    expect(WORDS.every((w) => /^[a-z]{3,7}$/.test(w))).toBe(true);
  });
});

describe('passphrase', () => {
  it('default: 5 hyphen-separated words drawn from the list, rendered as code', () => {
    const r = run({});
    const parts = r.output.split('-');
    expect(parts).toHaveLength(5);
    const set = new Set(WORDS);
    expect(parts.every((p) => set.has(p))).toBe(true);
    expect(r.render).toBe('code');
  });

  it('separator branches', () => {
    expect(run({ words: 4, separator: 'space' }).output.split(' ')).toHaveLength(4);
    expect(run({ words: 4, separator: 'dot' }).output.split('.')).toHaveLength(4);
    expect(run({ words: 4, separator: 'underscore' }).output.split('_')).toHaveLength(4);
    const none = run({ words: 4, separator: 'none' }).output;
    expect(none).toMatch(/^[a-z]+$/);
    expect(none.includes('-')).toBe(false);
  });

  it('capitalize option upper-cases the first letter of every word', () => {
    const parts = run({ words: 6, capitalize: true }).output.split('-');
    expect(parts).toHaveLength(6);
    expect(parts.every((p) => /^[A-Z][a-z]{2,6}$/.test(p))).toBe(true);
  });

  it('addNumber appends a 0–999 segment', () => {
    for (let i = 0; i < 20; i++) {
      const parts = run({ words: 4, addNumber: true }).output.split('-');
      expect(parts).toHaveLength(5);
      const n = Number(parts[4]);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(999);
    }
  });

  it('clamps the word count to 3..12', () => {
    expect(run({ words: 99 }).output.split('-')).toHaveLength(12);
    expect(run({ words: 1 }).output.split('-')).toHaveLength(3);
  });

  it('reports entropy = log2(listSize) * words', () => {
    const expected = Math.round(Math.log2(WORDS.length) * 5);
    expect(run({ words: 5 }).stats!['entropy (bits)']).toBe(expected);
    expect(run({}).stats!['wordlist size']).toBe(WORDS.length);
  });

  it('throws ToolError when the word count is not a number', () => {
    expect(() => run({ words: 'abc' })).toThrow(ToolError);
  });

  it('still generates for empty text input (it is a generator)', () => {
    expect(run({}, '').output).not.toBe('');
  });
});
