import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './etag.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('etag', () => {
  it('builds strong and weak quoted tags', () => {
    expect(run('asset-v42', { mode: 'build' }).output).toBe('"asset-v42"');
    expect(run('asset-v42', { mode: 'build', weak: true }).output).toBe('W/"asset-v42"');
  });

  it('analyzes strong, weak, and wildcard tags', () => {
    const result = run('W/"abc", "def", *');
    expect(rows(result)).toEqual([
      ['W/"abc"', 'weak', 'abc', 'Valid'],
      ['"def"', 'strong', 'def', 'Valid'],
      ['*', 'wildcard', '', 'Valid'],
    ]);
  });

  it('compares weak and strong validators correctly', () => {
    expect(run('W/"abc"', { mode: 'compare', secondTag: '"abc"' }).output).toBe('Match');
    expect(run('W/"abc"', { mode: 'compare', secondTag: '"abc"', comparison: 'strong' }).output).toBe('No match');
    expect(run('"abc"', { mode: 'compare', secondTag: '*' }).output).toBe('Match');
  });

  it('rejects malformed tags and unsafe build tokens', () => {
    expect(() => run('abc', { mode: 'compare', secondTag: '"abc"' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build' })).toThrow(ToolError);
    expect(() => run('bad"token', { mode: 'build' })).toThrow(ToolError);
  });

  it('handles invalid values in analysis mode', () => {
    const result = run('"ok", broken, W/"also-ok"');
    expect(result.stats).toMatchObject({ tags: 3, invalid: 1, wildcard: 0 });
    expect(rows(result)[1]?.[3]).toBe('Invalid ETag');
  });

  it('returns guidance for blank analysis input', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
