import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './cache-control.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('cache-control', () => {
  it('builds a cache policy with lifetime and revalidation directives', () => {
    const result = run('', {
      mode: 'build',
      visibility: 'public',
      maxAge: 31536000,
      immutable: true,
      staleWhileRevalidate: 60,
    });
    expect(result.output).toBe('public, max-age=31536000, immutable, stale-while-revalidate=60');
    expect(result.filename).toBe('cache-control.txt');
  });

  it('analyzes valid directives', () => {
    const result = run('public, max-age=31536000, immutable');
    expect(rows(result)).toContainEqual(['max-age', '31536000', 'No local issues detected']);
    expect(result.stats?.issues).toBe(0);
  });

  it('flags contradictory and duplicate directives', () => {
    const result = run('no-store, public, max-age=60, public, immutable');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(rows(result)[0]?.[2]).toContain('no-store conflicts');
  });

  it('analyzes multiple header values and invalid directive values', () => {
    const result = run('private, max-age=abc\npublic, max-age=10');
    expect(result.stats?.headers).toBe(2);
    expect(result.stats?.issues).toBeGreaterThan(0);
  });

  it('rejects invalid generated lifetimes and visibility', () => {
    expect(() => run('', { mode: 'build', maxAge: -1 })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', visibility: 'shared' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', staleWhileRevalidate: 1.5 })).toThrow(ToolError);
  });

  it('returns guidance for blank analysis input', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
