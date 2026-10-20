import { describe, expect, it } from 'vitest';
import tool from './prime-factorization.tool';

type Result = {
  output: string;
  render?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
type Table = { headers: string[]; rows: [string, string][] };

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const table = (text: string, options: Record<string, string | number | boolean> = {}) =>
  JSON.parse(run(text, options).output) as Table;
const get = (text: string, key: string, options: Record<string, string | number | boolean> = {}) =>
  table(text, options).rows.find((r) => r[0] === key)?.[1];

describe('prime-factorization', () => {
  it('shows guidance on blank input', () => {
    const result = run(' ');
    expect(result.render).toBe('table');
    expect(result.notes?.join(' ')).toMatch(/whole number/i);
  });

  it('factors a composite number into prime powers', () => {
    expect(get('360', 'Prime factorization')).toBe('2^3 × 3^2 × 5');
    expect(get('360', 'τ(n) — divisors')).toBe('24');
    expect(get('360', 'σ(n) — sum of divisors')).toBe('1,170');
    expect(get('360', 'φ(n) — totient')).toBe('96');
  });

  it('reports a prime itself', () => {
    const result = run('17');
    expect(get('17', 'Prime factorization')).toBe('17');
    expect(result.notes?.join(' ')).toMatch(/prime/i);
  });

  it('handles 1 and 0 gracefully', () => {
    expect(get('1', 'Prime factorization')).toBe('(none)');
    expect(get('0', 'Prime factorization')).toBe('(none)');
  });

  it('handles negative input by ignoring the sign', () => {
    const negative = table('-360');
    const positive = table('360');
    expect(negative.rows.find((r) => r[0] === 'Sign')?.[1]).toBe('negative');
    expect(negative.rows.find((r) => r[0] === 'Prime factorization')?.[1]).toBe(
      positive.rows.find((r) => r[0] === 'Prime factorization')?.[1],
    );
  });

  it('detects and handles large numbers via BigInt', () => {
    const result = run('123456789012345678901234567890');
    expect(get('123456789012345678901234567890', 'Prime factorization')).toContain('×');
    expect(result.output).not.toBe('');
    expect(result.stats?.divisors).toBeGreaterThan(0);
  });

  it('is-prime mode reports primality', () => {
    expect(run('17', { mode: 'is-prime' }).stats?.isPrime).toBe(1);
    expect(run('18', { mode: 'is-prime' }).stats?.isPrime).toBe(0);
    expect(get('97', 'Primality', { mode: 'is-prime' })).toBe('PRIME');
  });

  it('primes-below mode lists primes and counts', () => {
    const ps = table('30', { mode: 'primes-below' });
    const primes = ps.rows.slice(1).map((r) => r[1]);
    expect(primes).toEqual(['2', '3', '5', '7', '11', '13', '17', '19', '23', '29']);
    expect(ps.rows[0]).toEqual(['Prime count', '10']);
    expect(get('10', 'Prime count', { mode: 'primes-below' })).toBe('4'); // 2,3,5,7
  });

  it('rejects invalid input', () => {
    expect(() => run('abc')).toThrow(/valid whole number/i);
    expect(() => run('12.5')).toThrow(/valid whole number/i);
  });

  it('lists divisors when asked and hides them otherwise', () => {
    const withDiv = table('12');
    expect(withDiv.rows.find((r) => r[0] === 'Divisors')?.[1]).toContain('1, 2, 3, 4, 6, 12');
    const without = table('12', { showDivisors: false });
    expect(without.rows.find((r) => r[0] === 'Divisors')).toBeUndefined();
  });
});
