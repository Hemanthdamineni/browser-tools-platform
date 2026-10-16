import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './document-policy.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('document-policy', () => {
  it('builds a policy header', () => {
    const result = run('', { mode: 'build', directives: 'unload=(), sync-xhr=()' });
    expect(result.output).toBe('unload=(), sync-xhr=()');
    expect(result.filename).toBe('document-policy.txt');
  });

  it('analyzes valid directives', () => {
    const result = run('unload=(), sync-xhr=()');
    expect(result.stats).toMatchObject({ directives: 2, issues: 0 });
    expect(rows(result)[0]?.[2]).toBe('Valid');
  });

  it('flags duplicates and high thresholds', () => {
    const result = run('layout-animations=(1001), layout-animations=()');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(rows(result)[0]?.[2]).toBe('Review');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', directives: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', directives: 'unload=true' })).toThrow(ToolError);
  });

  it('handles malformed input and blank analysis', () => {
    expect(rows(run('broken'))).toHaveLength(0);
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('normalizes directive names', () => {
    expect(run('', { mode: 'build', directives: 'UNLOAD=()' }).output).toBe('unload=()');
  });
});
