import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './accept-post.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('accept-post', () => {
  it('builds normalized POST capabilities', () => {
    const result = run('', {
      mode: 'build',
      types: 'application/json, application/x-www-form-urlencoded',
    });
    expect(result.output).toBe('application/json, application/x-www-form-urlencoded');
    expect(result.filename).toBe('accept-post.txt');
  });

  it('analyzes media types and parameters', () => {
    const result = run('application/json; charset=utf-8');
    expect(result.stats).toMatchObject({ types: 1, issues: 0, wildcard: 'no' });
    expect(rows(result)[0]?.[1]).toBe('Valid');
  });

  it('flags invalid types, duplicates, and wildcard scope', () => {
    const result = run('application/json, application/json, */*');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.stats?.wildcard).toBe('yes');
    expect(result.notes?.join(' ')).toContain('Wildcard');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', types: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', types: 'not-a-media-type' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', types: 'application/json; bad' })).toThrow(ToolError);
  });

  it('handles malformed input and blank analysis', () => {
    expect(rows(run('not-a-media-type'))[0]?.[1]).toBe('Review');
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('normalizes case and whitespace', () => {
    expect(run('', { mode: 'build', types: ' Application/JSON ' }).output).toBe('application/json');
  });
});
