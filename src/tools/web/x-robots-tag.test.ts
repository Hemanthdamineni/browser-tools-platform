import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './x-robots-tag.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('x-robots-tag', () => {
  it('builds an X-Robots-Tag header', () => {
    const result = run('', { mode: 'build', value: 'noindex, nofollow' });
    expect(result.output).toBe('X-Robots-Tag: noindex, nofollow');
    expect(result.filename).toBe('x-robots-tag.txt');
  });

  it('accepts a crawler-targeted group', () => {
    const result = run('', { mode: 'build', value: 'googlebot: noindex' });
    expect(result.stats?.groups).toBe(1);
  });

  it('analyzes valid directives', () => {
    const result = run('noindex, noarchive');
    expect(result.stats?.groups).toBe(1);
    expect(rows(result)[0]?.[0]).toBe('(all)');
    expect(rows(result)[0]?.[2]).toBe('Valid');
  });

  it('flags conflicting index/nofollow pairs', () => {
    const result = run('index, noindex');
    expect(result.notes?.join(' ')).toContain('Conflicting');
  });

  it('flags unknown directives and bad max-snippet', () => {
    const a = run('bogus-directive');
    expect(a.notes?.join(' ')).toContain('Unknown');
    const b = run('max-snippet:abc');
    expect(b.notes?.join(' ')).toContain('max-snippet');
  });

  it('rejects invalid build and handles blank analysis', () => {
    expect(() => run('', { mode: 'build', value: 'index, noindex' })).toThrow(ToolError);
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
