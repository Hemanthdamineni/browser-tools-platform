import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './if-none-match.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('if-none-match', () => {
  it('builds a cache validation condition', () => {
    const result = run('', { mode: 'build', tag: '"v1-abc123"', method: 'GET' });
    expect(result.output).toBe('"v1-abc123"');
    expect(result.filename).toBe('if-none-match.txt');
  });

  it('analyzes strong, weak, and wildcard values', () => {
    const result = run('"v1"\nW/"v2"\n*');
    expect(result.stats).toMatchObject({ tags: 3, invalid: 0, review: 0 });
    expect(rows(result)[1]?.[2]).toContain('Weak');
    expect(rows(result)[2]?.[2]).toContain('create-if-absent');
  });

  it('flags malformed and duplicate tags', () => {
    const result = run('"v1"\n"v1"\nbad-tag');
    expect(result.stats?.review).toBe(3);
    expect(rows(result)[0]?.[1]).toBe('Review');
    expect(rows(result)[2]?.[1]).toBe('Invalid');
  });

  it('rejects invalid generated conditions', () => {
    expect(() => run('', { mode: 'build', tag: 'bad-tag' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', wildcard: true, weak: true })).toThrow(ToolError);
  });

  it('handles blank analysis input with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('builds wildcard and weak values', () => {
    expect(run('', { mode: 'build', wildcard: true, method: 'PUT' }).output).toBe('*');
    expect(run('', { mode: 'build', weak: true, tag: '"v1"' }).output).toBe('W/"v1"');
  });
});
