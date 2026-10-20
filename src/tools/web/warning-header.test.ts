import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './warning-header.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('warning-header', () => {
  it('builds a Warning header', () => {
    const result = run('', { mode: 'build', code: '110', agent: '-', text: 'Response is Stale' });
    expect(result.output).toBe('Warning: 110 - "Response is Stale"');
    expect(result.filename).toBe('warning-header.txt');
  });

  it('analyzes a valid cache warning', () => {
    const result = run('110 - "Response is Stale"');
    expect(result.stats).toMatchObject({ warnings: 1, valid: 1 });
    expect(rows(result)[0]?.[5]).toBe('Response is Stale');
  });

  it('analyzes multiple warnings separated by commas', () => {
    const result = run('110 cache "Response is Stale", 111 cache "Revalidation Failed"');
    expect(result.stats?.warnings).toBe(2);
  });

  it('flags unrecognized codes and missing quoted text', () => {
    const result = run('999 cache no-quotes');
    expect(result.stats?.valid).toBe(0);
    expect(result.notes?.join(' ')).toContain('Unrecognized');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', code: '42', agent: '-', text: 'x' })).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
