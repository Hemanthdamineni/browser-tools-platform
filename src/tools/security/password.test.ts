import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './password.tool';

type Res = { output: string; render?: string; stats?: Record<string, string | number> };
const run = (options: Record<string, string | number | boolean> = {}, text = '') =>
  tool.run({ text, options }) as Res;
const lines = (r: Res) => r.output.split('\n');

describe('password', () => {
  it('generates one password of the requested length, rendered as code', () => {
    const r = run({ length: 20 });
    expect(lines(r)).toHaveLength(1);
    expect(lines(r)[0]!).toHaveLength(20);
    expect(r.render).toBe('code');
  });

  it('length option is honoured', () => {
    expect(lines(run({ length: 40 }))[0]!).toHaveLength(40);
    expect(lines(run({ length: 4 }))[0]!).toHaveLength(4);
  });

  it('count option produces that many unique lines', () => {
    const r = run({ length: 24, count: 25 });
    expect(lines(r)).toHaveLength(25);
    expect(new Set(lines(r)).size).toBe(25);
    expect(r.stats!['generated']).toBe(25);
  });

  it('digits-only branch: known charset, pool size and entropy', () => {
    const r = run({ length: 10, uppercase: false, lowercase: false, symbols: false });
    expect(lines(r)[0]!).toMatch(/^[0-9]{10}$/);
    expect(r.stats!['pool size']).toBe(10);
    expect(r.stats!['entropy (bits)']).toBe(33); // round(log2(10) * 10)
  });

  it('lowercase-only and uppercase-only branches', () => {
    expect(lines(run({ length: 12, uppercase: false, digits: false, symbols: false }))[0]!).toMatch(
      /^[a-z]{12}$/,
    );
    expect(lines(run({ length: 12, lowercase: false, digits: false, symbols: false }))[0]!).toMatch(
      /^[A-Z]{12}$/,
    );
  });

  it('symbols-only branch contains no alphanumerics', () => {
    const s = lines(run({ length: 16, uppercase: false, lowercase: false, digits: false }))[0]!;
    expect(s).toHaveLength(16);
    expect(/[A-Za-z0-9]/.test(s)).toBe(false);
  });

  it('guarantees at least one character from every selected class', () => {
    for (let i = 0; i < 20; i++) {
      const s = lines(run({ length: 8 }))[0]!;
      expect(/[A-Z]/.test(s)).toBe(true);
      expect(/[a-z]/.test(s)).toBe(true);
      expect(/[0-9]/.test(s)).toBe(true);
      expect(/[^A-Za-z0-9]/.test(s)).toBe(true);
    }
  });

  it('avoidAmbiguous drops 0 O 1 l I | and backtick', () => {
    for (let i = 0; i < 30; i++) {
      const s = lines(run({ length: 40, avoidAmbiguous: true }))[0]!;
      expect(/[0O1lI|`]/.test(s)).toBe(false);
    }
  });

  it('throws ToolError when no character class is selected', () => {
    expect(() =>
      run({ uppercase: false, lowercase: false, digits: false, symbols: false }),
    ).toThrow(ToolError);
    expect(() =>
      run({ uppercase: false, lowercase: false, digits: false, symbols: false }),
    ).toThrow(/at least one character type/i);
  });

  it('throws ToolError when length or count is not a number', () => {
    expect(() => run({ length: 'abc' })).toThrow(ToolError);
    expect(() => run({ count: 'abc' })).toThrow(ToolError);
  });

  it('still generates for empty text input (it is a generator)', () => {
    expect(run({ length: 16 }, '').output).not.toBe('');
  });

  it('reports a strength word', () => {
    expect(String(run({ length: 20 }).stats!['strength'])).toMatch(
      /very weak|weak|reasonable|strong|very strong/,
    );
  });
});
