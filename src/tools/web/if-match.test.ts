import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './if-match.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('if-match', () => {
  it('builds a strong entity-tag condition', () => {
    const result = run('', { mode: 'build', tag: '"v1-abc123"' });
    expect(result.output).toBe('"v1-abc123"');
    expect(result.filename).toBe('if-match.txt');
  });

  it('analyzes strong and wildcard conditions', () => {
    const result = run('"v1-abc123"\n*');
    expect(result.stats).toMatchObject({ tags: 2, invalid: 0, review: 0 });
    expect(rows(result)[0]?.[2]).toContain('Strong');
    expect(rows(result)[1]?.[2]).toContain('Wildcard');
  });

  it('flags weak, malformed, and duplicate tags', () => {
    const result = run('W/"v1"\nW/"v1"\nbad-tag');
    expect(result.stats?.review).toBe(3);
    expect(rows(result)[0]?.[2]).toContain('Weak');
    expect(rows(result)[2]?.[1]).toBe('Invalid');
  });

  it('rejects invalid generated conditions', () => {
    expect(() => run('', { mode: 'build', tag: 'bad-tag' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', weak: true, tag: 'bad-tag' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', weak: true, wildcard: true })).toThrow(ToolError);
  });

  it('handles blank analysis input with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('builds wildcard and weak values explicitly', () => {
    expect(run('', { mode: 'build', wildcard: true }).output).toBe('*');
    expect(run('', { mode: 'build', weak: true, tag: '"v1"' }).output).toBe('W/"v1"');
  });
});
