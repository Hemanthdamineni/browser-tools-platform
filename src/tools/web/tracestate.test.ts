import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './tracestate.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('tracestate', () => {
  it('builds a vendor entry', () => {
    const result = run('', { mode: 'build', key: 'vendor', value: 'opaque-value' });
    expect(result.output).toBe('vendor=opaque-value');
    expect(result.filename).toBe('tracestate.txt');
  });

  it('analyzes valid entries', () => {
    const result = run('vendor=opaque-value,congo=t61rcWkgMzE');
    expect(result.stats).toMatchObject({ entries: 2, issues: 0 });
    expect(rows(result)[1]?.[2]).toBe('Valid');
  });

  it('flags duplicate and invalid members', () => {
    const result = run('Vendor=bad value,vendor=ok,vendor=again');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('Duplicate');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', key: '', value: 'x' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', key: 'vendor', value: 'bad value' })).toThrow(ToolError);
  });

  it('handles malformed input and blank analysis', () => {
    expect(run('broken').stats?.issues).toBe(1);
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('enforces the 32-entry limit', () => {
    const value = Array.from({ length: 33 }, (_, index) => `k${index}=v`).join(',');
    expect(run(value).notes?.join(' ')).toContain('32');
  });
});
