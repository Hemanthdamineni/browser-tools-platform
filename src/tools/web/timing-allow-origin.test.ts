import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './timing-allow-origin.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('timing-allow-origin', () => {
  it('builds a narrow metrics grant', () => {
    const result = run('', { mode: 'build', origins: 'https://metrics.example.com' });
    expect(result.output).toBe('https://metrics.example.com');
    expect(result.filename).toBe('timing-allow-origin.txt');
  });

  it('analyzes a valid origin list', () => {
    const result = run('https://metrics.example.com, https://analytics.example.com');
    expect(result.stats).toMatchObject({ origins: 2, issues: 0, wildcard: 'no' });
    expect(rows(result)[0]?.[1]).toBe('Valid');
  });

  it('flags wildcard broadness and redundancy', () => {
    const result = run('*, https://metrics.example.com');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('wildcard');
  });

  it('rejects malformed tokens and duplicates', () => {
    const result = run('https://metrics.example.com, ftp://bad.example.com, https://metrics.example.com');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(rows(result).some((row) => row[1] === 'Invalid')).toBe(true);
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', origins: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', origins: 'javascript:alert(1)' })).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
