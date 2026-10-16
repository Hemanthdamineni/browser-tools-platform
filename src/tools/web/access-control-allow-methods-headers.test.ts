import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './access-control-allow-methods-headers.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('access-control-allow-methods-headers', () => {
  it('builds a grant set', () => {
    const result = run('', { mode: 'build', methods: 'GET, POST', headers: 'Content-Type' });
    expect(result.output).toContain('Access-Control-Allow-Methods: GET, POST');
    expect(result.output).toContain('Access-Control-Allow-Headers: Content-Type');
    expect(result.filename).toBe('cors-preflight.txt');
  });

  it('analyzes valid preflight lines', () => {
    const result = run('Access-Control-Allow-Methods: GET, HEAD\nAccess-Control-Allow-Headers: Content-Type');
    expect(result.stats).toMatchObject({ methods: 2, headers: 1, issues: 0 });
    expect(rows(result).every((row) => row[2] === 'Valid')).toBe(true);
  });

  it('flags duplicates and invalid tokens', () => {
    const result = run('Access-Control-Allow-Methods: GET,, GET\nAccess-Control-Allow-Headers: 9z_ header-name@');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('Duplicate');
  });

  it('flags redundant wildcard combinations', () => {
    const result = run('Access-Control-Allow-Methods: *, GET');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('wildcard');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', methods: 'GET; POST', headers: 'X' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', methods: 'GET, GET', headers: 'X' })).toThrow(ToolError);
  });

  it('handles blank and malformed analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
    expect(run('garbage line').stats?.issues).toBeGreaterThan(0);
  });
});
