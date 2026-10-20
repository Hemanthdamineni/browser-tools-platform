import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './proxy-status.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('proxy-status', () => {
  it('builds a diagnostic entry', () => {
    const result = run('', { mode: 'build', proxy: 'edge', error: 'connection_refused' });
    expect(result.output).toBe('edge; error=connection_refused');
    expect(result.filename).toBe('proxy-status.txt');
  });

  it('analyzes parameters and quoted next proxy', () => {
    const result = run('edge; error=connection_refused; next="upstream"');
    expect(result.stats).toMatchObject({ entries: 1, invalid: 0, review: 0 });
    expect(rows(result)[1]?.[1]).toBe('next');
    expect(rows(result)[1]?.[2]).toBe('upstream');
  });

  it('flags duplicate and unknown parameters', () => {
    const result = run('edge; error=timeout; error=bad; vendor=value');
    expect(result.stats?.review).toBe(1);
    expect(rows(result)[0]?.[3]).toContain('Duplicate');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', proxy: '', error: 'x' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', proxy: 'edge', error: 'bad error' })).toThrow(ToolError);
  });

  it('handles malformed input and blank analysis', () => {
    expect(rows(run('not valid; broken'))[0]?.[3]).toContain('Malformed');
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('supports received status validation', () => {
    const result = run('edge; received-status=502');
    expect(result.stats?.review).toBe(0);
    expect(rows(result)[0]?.[1]).toBe('received-status');
  });
});
