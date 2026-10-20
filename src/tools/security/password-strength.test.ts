import { describe, expect, it } from 'vitest';
import tool from './password-strength.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;

describe('password-strength', () => {
  it('flags a very common password as weak', () => {
    const result = run('password123');
    expect(result.stats?.score).toBeLessThan(40);
    expect(result.notes?.join(' ')).toContain('commonly used');
  });

  it('scores a strong mixed password highly', () => {
    const result = run('P@ssw0rd-2026!Xy');
    expect(result.stats?.score).toBeGreaterThanOrEqual(80);
    const out = JSON.parse(result.output) as { rows: string[][] };
    expect(out.rows[0]?.[4]).toBe('Strong');
  });

  it('penalizes short passwords', () => {
    const result = run('Ab1!');
    expect(result.stats?.score).toBeLessThan(40);
  });

  it('penalizes all-lowercase words but still reports bit strength', () => {
    const result = run('sunshine');
    expect(typeof result.stats?.bits).toBe('number');
    expect(result.stats?.score).toBeLessThan(50);
  });

  it('flags repeated characters', () => {
    const result = run('Aaaaa1111');
    expect(result.notes?.join(' ')).toContain('Repeated');
  });

  it('handles blank input', () => {
    const result = run('');
    expect(result.notes?.[0]).toContain('Type a password');
    expect(result.stats?.score).toBe(0);
  });
});
