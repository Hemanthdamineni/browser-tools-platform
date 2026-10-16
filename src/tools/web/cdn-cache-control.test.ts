import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './cdn-cache-control.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('cdn-cache-control', () => {
  it('builds normalized directives', () => {
    const result = run('', { mode: 'build', directives: 'max-age=3600, stale-while-revalidate=60' });
    expect(result.output).toBe('max-age=3600, stale-while-revalidate=60');
    expect(result.filename).toBe('cdn-cache-control.txt');
  });

  it('analyzes valid shared-cache directives', () => {
    const result = run('max-age=3600, public, stale-if-error=86400');
    expect(result.stats).toMatchObject({ directives: 3, issues: 0 });
    expect(rows(result)[1]?.[0]).toBe('public');
  });

  it('flags duplicates and conflicting no-store policy', () => {
    const result = run('no-store, max-age=60, max-age=120');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('conflicts');
  });

  it('rejects invalid generated directives', () => {
    expect(() => run('', { mode: 'build', directives: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', directives: 'max-age=soon' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', directives: 'public=true' })).toThrow(ToolError);
  });

  it('handles malformed input and blank analysis', () => {
    expect(rows(run('max-age=bad'))[0]?.[2]).toBe('Review');
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('accepts quoted numeric values', () => {
    expect(run('s-maxage="600"').stats?.issues).toBe(0);
  });
});
