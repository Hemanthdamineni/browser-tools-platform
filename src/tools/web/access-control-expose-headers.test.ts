import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './access-control-expose-headers.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;

describe('access-control-expose-headers', () => {
  it('builds an expose list', () => {
    const result = run('', { mode: 'build', headers: 'X-Request-Id, X-Rate-Limit' });
    expect(result.output).toBe('X-Request-Id, X-Rate-Limit');
    expect(result.filename).toBe('access-control-expose-headers.txt');
  });

  it('analyzes valid headers and explains the safelist', () => {
    const result = run('X-Total-Count');
    expect(result.stats).toMatchObject({ headers: 1, issues: 0, wildcard: 'no' });
    expect(result.notes?.join(' ')).toContain('CORS-safelisted');
  });

  it('flags invalid tokens and duplicates', () => {
    const result = run('X-Total-Count, header-name@mail, X-Total-Count');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('Invalid');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', headers: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', headers: 'bad header names' })).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('accepts wildcard in analysis', () => {
    const result = run('*');
    expect(result.stats).toMatchObject({ wildcard: 'yes', issues: 0 });
  });
});
