import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import bcrypt from 'bcryptjs';
import tool from './bcrypt.tool';
import {
  COST_MAX,
  COST_MIN,
  estimateTimeMs,
  extractRounds,
  formatEstimate,
  looksLikeBcryptHash,
  validateCost,
} from './bcrypt.core';

type Result = {
  output: string;
  stats?: Record<string, string | number>;
  warnings?: string[];
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;

describe('bcrypt core', () => {
  it('validates cost within the supported range', () => {
    expect(validateCost(4)).toBe(4);
    expect(validateCost(10)).toBe(10);
    expect(validateCost(15)).toBe(15);
    expect(validateCost('10')).toBe(10);
  });

  it('rejects out-of-range, fractional and non-numeric costs', () => {
    for (const bad of [3, 16, 10.5, 'abc', true, undefined]) {
      expect(() => validateCost(bad as never)).toThrow(ToolError);
    }
  });

  it('detects well-formed bcrypt hashes and extracts rounds', () => {
    const h = bcrypt.hashSync('hunter2', 6);
    expect(looksLikeBcryptHash(h)).toBe(true);
    expect(extractRounds(h)).toBe(6);
  });

  it('rejects strings that are not bcrypt hashes', () => {
    for (const bad of ['', 'plaintext', 'abc123', '$2z$10$xxxxxxxxxxxxxx', '$$10$$']) {
      expect(looksLikeBcryptHash(bad)).toBe(false);
      expect(extractRounds(bad)).toBe(null);
    }
  });

  it('accepts all bcrypt variants ($2a/$2b/$2x/$2y) with round extraction', () => {
    for (const prefix of ['$2a$', '$2b$', '$2x$', '$2y$']) {
      const body = '10$' + 'A'.repeat(53);
      expect(looksLikeBcryptHash(`${prefix}${body}`)).toBe(true);
      expect(extractRounds(`${prefix}${body}`)).toBe(10);
    }
  });

  it('models estimated time as doubling per round, scaled from cost 10', () => {
    expect(estimateTimeMs(10)).toBe(100);
    expect(estimateTimeMs(11)).toBe(200);
    expect(estimateTimeMs(9)).toBe(50);
    expect(estimateTimeMs(4)).toBe(2);
    expect(formatEstimate(10)).toMatch(/ms|s/);
    expect(formatEstimate(15)).toContain('s');
  });
});

describe('bcrypt tool', () => {
  it('hashes a password and produces a verifiable bcrypt hash', () => {
    const result = run('hunter2', { mode: 'hash', cost: 4 });
    expect(result.output).toMatch(/^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/);
    expect(result.stats?.mode).toBe('Hash');
    expect(result.stats?.cost).toBe(4);
    expect(result.stats?.length).toBe(60);
    expect(bcrypt.compareSync('hunter2', result.output)).toBe(true);
  });

  it('round-trips a real hash+verify through bcryptjs', () => {
    const hash = bcrypt.hashSync('correct horse battery staple', 4);
    const ok = run('correct horse battery staple', { mode: 'verify', hash });
    expect(ok.output).toContain('Match');
    expect(ok.stats?.result).toBe('Match');
    expect(ok.stats?.['hash cost']).toBe(4);

    const bad = run('wrong password', { mode: 'verify', hash });
    expect(bad.output).toContain('No match');
    expect(bad.stats?.result).toBe('No match');
  });

  it('returns empty output for empty input', () => {
    expect(run('').output).toBe('');
  });

  it('throws when the stored hash is blank or malformed', () => {
    expect(() => run('pw', { mode: 'verify', hash: '' })).toThrow(/Enter the bcrypt hash/);
    expect(() => run('pw', { mode: 'verify', hash: 'not-a-hash' })).toThrow(/does not look like/);
    expect(() => run('pw', { mode: 'verify', hash: '$2b$10$broken' })).toThrow(
      /does not look like/,
    );
  });

  it('warns when the password exceeds 72 bytes', () => {
    const long = 'x'.repeat(90);
    const result = run(long, { mode: 'hash', cost: 4 });
    expect(result.warnings?.[0]).toContain('72 bytes');
    expect(bcrypt.compareSync(long, result.output)).toBe(true);
  });

  it('hashes are salted: identical input yields different hashes', () => {
    const a = run('same-password', { mode: 'hash', cost: 4 });
    const b = run('same-password', { mode: 'hash', cost: 4 });
    expect(a.output).not.toBe(b.output);
  });

  it('rejects out-of-range costs with a friendly error', () => {
    const message = new RegExp(`between ${COST_MIN} and ${COST_MAX}`);
    expect(() => run('pw', { mode: 'hash', cost: 20 })).toThrow(message);
    expect(() => run('pw', { mode: 'hash', cost: 3 })).toThrow(message);
  });
});