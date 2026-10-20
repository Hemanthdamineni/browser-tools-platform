import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './allow-header.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('allow-header', () => {
  it('builds a normalized Allow header', () => {
    const result = run('', { mode: 'build', methods: 'get, post, options' });
    expect(result.output).toBe('GET, POST, OPTIONS');
    expect(result.filename).toBe('allow.txt');
  });

  it('analyzes standard methods', () => {
    const result = run('GET, POST, OPTIONS, HEAD');
    expect(result.stats).toMatchObject({ methods: 4, issues: 0, standard: 4 });
    expect(rows(result)[0]?.[1]).toBe('Valid');
  });

  it('flags missing HEAD, duplicates, wildcard combinations, and extensions', () => {
    const result = run('GET, GET, X-CUSTOM, *');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('HEAD');
  });

  it('rejects invalid generated method lists', () => {
    expect(() => run('', { mode: 'build', methods: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', methods: 'GET, GET' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', methods: 'BAD METHOD' })).toThrow(ToolError);
  });

  it('allows a valid custom method while reporting it', () => {
    const result = run('PROPFIND');
    expect(result.stats?.standard).toBe(0);
    expect(rows(result)[0]?.[2]).toContain('Non-standard');
  });

  it('returns guidance for blank analysis input', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
