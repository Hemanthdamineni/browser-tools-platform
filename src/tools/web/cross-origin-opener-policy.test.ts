import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './cross-origin-opener-policy.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('cross-origin-opener-policy', () => {
  it('builds a strict opener policy', () => {
    const result = run('', { mode: 'build', value: 'same-origin' });
    expect(result.output).toBe('same-origin');
    expect(result.filename).toBe('cross-origin-opener-policy.txt');
  });

  it('analyzes supported policy values', () => {
    expect(run('same-origin').stats).toMatchObject({ valid: 'yes', isolated: 'yes' });
    expect(rows(run('same-origin-allow-popups'))[0]?.[2]).toContain('popup');
  });

  it('rejects unsupported policy values', () => {
    const result = run('same-site');
    expect(result.stats?.valid).toBe('no');
    expect(rows(result)[0]?.[2]).toContain('same-origin');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', value: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', value: 'same-site' })).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('normalizes case and whitespace', () => {
    expect(run('', { mode: 'build', value: ' SAME-ORIGIN ' }).output).toBe('same-origin');
  });
});
