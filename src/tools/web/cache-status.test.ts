import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './cache-status.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('cache-status', () => {
  it('analyzes a common CDN report', () => {
    const result = run('CDN; hit; ttl=60; stored; fwd=uru');
    expect(result.stats?.parameters).toBeGreaterThan(0);
    expect(result.notes?.[0]).toContain('CDN');
  });

  it('recognizes hit miss and ttl members', () => {
    const result = run('CDN; miss; ttl=60; stored');
    const text = JSON.stringify(rows(result));
    expect(text).toContain('miss');
    expect(result.stats?.issues).toBe(0);
  });

  it('flags unknown member parameters as issues', () => {
    const result = run('CDN; bogus=1; ttl="bad"');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('Flagged');
  });

  it('builds a valid Cache-Status header', () => {
    const result = run('', { mode: 'build', cc: 'CDN', hit: 'hit', ttl: '60', fwd: '' });
    expect(result.output).toBe('CDN; hit; ttl=60');
    expect(result.filename).toBe('cache-status.txt');
  });

  it('rejects empty cache name in build', () => {
    expect(() => run('', { mode: 'build', cc: '  ', hit: 'hit', ttl: '', fwd: '' })).toThrow(
      ToolError,
    );
  });

  it('analyzes blank input with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
