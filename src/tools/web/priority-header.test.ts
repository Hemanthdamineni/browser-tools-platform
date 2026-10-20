import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './priority-header.tool';

type Result = { output: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('priority-header', () => {
  it('builds urgency and incremental parameters', () => {
    expect(run('', { mode: 'build', urgency: 1, incremental: true }).output).toBe('u=1, i');
  });

  it('analyzes valid priority values', () => {
    const result = run('u=1, i');
    expect(result.stats).toMatchObject({ issues: 0, urgency: 1, incremental: 'yes' });
    expect(rows(result)[0]).toEqual(['urgency', '1', 'Valid']);
  });

  it('flags invalid urgency, duplicates, and unknown parameters', () => {
    const result = run('u=9, u=2, x=1');
    expect(result.stats?.issues).toBe(3);
    expect(result.notes?.join(' ')).toContain('urgency');
  });

  it('rejects invalid generated urgency', () => {
    expect(() => run('', { mode: 'build', urgency: 8 })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', urgency: 1.5 })).toThrow(ToolError);
  });

  it('handles blank input with guidance', () => {
    expect(run('').notes?.[0]).toContain('Priority');
  });

  it('accepts a value without urgency', () => {
    const result = run('i');
    expect(result.stats?.urgency).toBe('unset');
    expect(result.stats?.incremental).toBe('yes');
  });
});
