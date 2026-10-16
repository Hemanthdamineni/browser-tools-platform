import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './clear-site-data.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('clear-site-data', () => {
  it('builds a logout wipe header', () => {
    const result = run('', { mode: 'build', targets: '"cookies", "storage", "cache"' });
    expect(result.output).toBe('"cookies", "storage", "cache"');
    expect(result.filename).toBe('clear-site-data.txt');
  });

  it('analyzes valid targets', () => {
    const result = run('"cookies", "storage"');
    expect(result.stats).toMatchObject({ targets: 2, issues: 0, wildcard: 'no' });
    expect(rows(result)[0]?.[1]).toBe('Valid');
  });

  it('flags wildcard with additional targets and duplicates', () => {
    const result = run('"*", "cookies", "cookies"');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('wildcard');
  });

  it('rejects malformed and unquoted targets', () => {
    const result = run('cookies, "bogus"');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(rows(result)[0]?.[1]).toBe('Invalid');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', targets: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', targets: 'cookies' })).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
