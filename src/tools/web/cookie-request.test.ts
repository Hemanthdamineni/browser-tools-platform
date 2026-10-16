import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './cookie-request.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('cookie-request', () => {
  it('parses a Cookie header into pairs', () => {
    const result = run('Cookie: session=abc123; theme=dark; locale=en-US');
    expect(result.stats?.pairs).toBe(3);
    expect(rows(result).every((r) => r[2] === 'Valid')).toBe(true);
    expect(rows(result)[0]?.[2]).toBe('Valid');
  });

  it('builds a Cookie header from pairs', () => {
    const result = run('', { mode: 'build', pairs: 'a=1; b=2' });
    expect(result.output).toBe('a=1; b=2');
    expect(result.filename).toBe('cookie-request.txt');
  });

  it('flags empty names and duplicates', () => {
    const result = run('a=1; a=2; =novalue-isthis-a-pair');
    expect(result.stats?.duplicates).toBe(1);
    expect(rows(result).filter((r) => r[2] === 'Duplicate').length).toBe(1);
    expect(rows(result).some((r) => (r[2] ?? '').includes('Invalid'))).toBe(true);
  });

  it('detects encoded values', () => {
    const result = run('data=hello%20world');
    expect(result.stats?.encoded).toBe('yes');
    expect(rows(result)[0]?.[1]).toBe('hello world');
  });

  it('rejects empty build and unsupported modes', () => {
    expect(() => run('', { mode: 'build', pairs: '' })).toThrow(ToolError);
    expect(() => run('x', { mode: 'nope' })).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
