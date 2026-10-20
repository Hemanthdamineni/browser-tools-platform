import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './cross-origin-resource-policy.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('cross-origin-resource-policy', () => {
  it('builds a same-site policy', () => {
    const result = run('', { mode: 'build', value: 'same-site' });
    expect(result.output).toBe('same-site');
    expect(result.filename).toBe('cross-origin-resource-policy.txt');
  });

  it('analyzes valid policies', () => {
    expect(run('same-origin').stats).toMatchObject({ valid: 'yes', broad: 'no' });
    expect(run('cross-origin').stats).toMatchObject({ valid: 'yes', broad: 'yes' });
    expect(rows(run('same-site'))[0]?.[1]).toBe('Valid');
  });

  it('rejects invalid policies', () => {
    const result = run('allow-all');
    expect(result.stats?.valid).toBe('no');
    expect(rows(result)[0]?.[2]).toContain('same-origin');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', value: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', value: 'origin' })).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('normalizes case and whitespace', () => {
    expect(run('', { mode: 'build', value: ' SAME-ORIGIN ' }).output).toBe('same-origin');
  });
});
