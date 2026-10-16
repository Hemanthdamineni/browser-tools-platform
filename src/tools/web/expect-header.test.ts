import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './expect-header.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('expect-header', () => {
  it('builds the standard expectation', () => {
    const result = run('', { mode: 'build', expectation: '100-continue' });
    expect(result.output).toBe('100-continue');
    expect(result.filename).toBe('expect.txt');
  });

  it('analyzes the standard expectation', () => {
    const result = run('100-continue');
    expect(result.stats).toMatchObject({ expectations: 1, issues: 0, standard: 1 });
    expect(rows(result)[0]?.[1]).toBe('Valid');
  });

  it('flags custom and duplicate expectations', () => {
    const result = run('100-continue, custom-expect, custom-expect');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(rows(result)[1]?.[2]).toContain('Custom');
  });

  it('rejects invalid generated expectations', () => {
    expect(() => run('', { mode: 'build', expectation: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', expectation: 'bad value' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', expectation: 'custom' })).toThrow(ToolError);
  });

  it('handles malformed values and blank input', () => {
    expect(rows(run('bad value'))[0]?.[1]).toBe('Review');
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('normalizes case and whitespace', () => {
    expect(run('', { mode: 'build', expectation: ' 100-CONTINUE ' }).output).toBe('100-continue');
  });
});
