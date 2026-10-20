import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './early-data.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('early-data', () => {
  it('builds the standardized signal', () => {
    const result = run('', { mode: 'build', value: '0' });
    expect(result.output).toBe('0');
    expect(result.filename).toBe('early-data.txt');
  });

  it('analyzes a valid signal', () => {
    const result = run('0');
    expect(result.stats).toMatchObject({ signals: 1, issues: 0 });
    expect(rows(result)[0]?.[1]).toBe('Valid');
  });

  it('flags unsupported values', () => {
    const result = run('1');
    expect(result.stats?.issues).toBe(2);
    expect(rows(result)[0]?.[2]).toContain('exactly 0');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', value: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', value: '1' })).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('trims valid signal input', () => {
    expect(run('', { mode: 'build', value: ' 0 ' }).output).toBe('0');
  });
});
