import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './if-modified-since.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];
const DATE = 'Wed, 21 Oct 2015 07:28:00 GMT';

describe('if-modified-since', () => {
  it('builds an IMF-fixdate condition', () => {
    const result = run('', { mode: 'build', date: DATE });
    expect(result.output).toBe(DATE);
    expect(result.filename).toBe('if-modified-since.txt');
  });

  it('accepts valid IMF-fixdate values', () => {
    const result = run(DATE);
    expect(result.stats).toMatchObject({ dates: 1, invalid: 0, review: 0 });
    expect(rows(result)[0]?.[1]).toBe('Valid');
  });

  it('flags obsolete date forms', () => {
    const result = run('Sunday, 06-Nov-94 08:49:37 GMT');
    expect(result.stats?.review).toBe(1);
    expect(rows(result)[0]?.[2]).toContain('IMF-fixdate');
  });

  it('rejects malformed generated dates', () => {
    expect(() => run('', { mode: 'build', date: 'not a date' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', date: '2024-01-01T00:00:00Z' })).toThrow(ToolError);
  });

  it('flags invalid analysis input and handles blank input', () => {
    expect(rows(run('not a date'))[0]?.[1]).toBe('Invalid');
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('accepts a valid leap-day date', () => {
    expect(run('Thu, 29 Feb 2024 12:00:00 GMT').stats?.invalid).toBe(0);
  });
});
