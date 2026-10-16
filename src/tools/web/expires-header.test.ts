import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './expires-header.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];
const DATE = 'Wed, 21 Oct 2030 07:28:00 GMT';

describe('expires-header', () => {
  it('builds an IMF-fixdate expiration', () => {
    const result = run('', { mode: 'build', date: DATE });
    expect(result.output).toBe(DATE);
    expect(result.filename).toBe('expires.txt');
  });

  it('accepts a future expiration', () => {
    const result = run(DATE);
    expect(result.stats).toMatchObject({ dates: 1, invalid: 0, review: 0 });
    expect(rows(result)[0]?.[1]).toBe('Valid');
  });

  it('flags past expiration dates', () => {
    const result = run('Wed, 21 Oct 2015 07:28:00 GMT');
    expect(result.stats?.review).toBe(1);
    expect(rows(result)[0]?.[2]).toContain('past');
  });

  it('flags obsolete forms and rejects malformed generated dates', () => {
    expect(rows(run('Sunday, 06-Nov-94 08:49:37 GMT'))[0]?.[2]).toContain('IMF-fixdate');
    expect(() => run('', { mode: 'build', date: 'not a date' })).toThrow(ToolError);
  });

  it('handles invalid analysis input and blank input', () => {
    expect(rows(run('not a date'))[0]?.[1]).toBe('Invalid');
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('accepts a leap-day expiration', () => {
    expect(run('Thu, 29 Feb 2024 12:00:00 GMT').stats?.invalid).toBe(0);
  });
});
