import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './referrer-policy.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('referrer-policy', () => {
  it('builds a normalized policy', () => {
    const result = run('', { mode: 'build', value: 'no-referrer' });
    expect(result.output).toBe('no-referrer');
    expect(result.filename).toBe('referrer-policy.txt');
  });

  it('analyzes a valid policy', () => {
    const result = run('strict-origin-when-cross-origin');
    expect(result.stats).toMatchObject({ policies: 1, issues: 0, effective: 'strict-origin-when-cross-origin' });
    expect(rows(result)[0]?.[1]).toBe('Valid');
  });

  it('explains list fallbacks and last-token-wins', () => {
    const result = run('no-referrer, strict-origin');
    expect(result.stats?.effective).toBe('strict-origin');
    expect(rows(result)).toHaveLength(2);
  });

  it('flags unsafe-url and legacy leakage', () => {
    const result = run('unsafe-url, no-referrer-when-downgrade');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('unsafe-url');
  });

  it('rejects unsupported and invalid generated values', () => {
    expect(() => run('', { mode: 'build', value: 'send-everything' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', value: 'unsafe-url' })).toThrow(ToolError);
    expect(rows(run('bogus-policy'))[0]?.[1]).toBe('Invalid');
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
