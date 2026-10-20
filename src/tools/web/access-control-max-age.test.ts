import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './access-control-max-age.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('access-control-max-age', () => {
  it('builds the 600s header', () => {
    const result = run('', { mode: 'build', seconds: '600' });
    expect(result.output).toBe('Access-Control-Max-Age: 600');
    expect(result.filename).toBe('access-control-max-age.txt');
  });

  it('builds with zero', () => {
    const result = run('', { mode: 'build', seconds: '0' });
    expect(result.output).toBe('Access-Control-Max-Age: 0');
  });

  it('analyzes a valid value', () => {
    const result = run('600');
    expect(result.stats).toMatchObject({ values: 1, invalid: 0 });
  });

  it('flags non-integer and negative values', () => {
    const result = run('abc\n-5');
    expect(result.stats?.invalid).toBe(2);
    expect(rows(result).every((row) => row[1] === 'Invalid')).toBe(true);
  });

  it('cautions on excessively large values', () => {
    const result = run('9999999');
    expect(result.notes?.join(' ')).toContain('cap');
    const versioned = run('6100');
    expect(versioned.stats?.invalid).toBe(0);
  });

  it('rejects invalid generated values and handles blank input', () => {
    expect(() => run('', { mode: 'build', seconds: 'nope' })).toThrow(ToolError);
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
