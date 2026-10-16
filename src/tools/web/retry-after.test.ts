import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './retry-after.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('retry-after', () => {
  it('builds a delta-seconds value', () => {
    const result = run('', { mode: 'build', form: 'seconds', seconds: 120 });
    expect(result.output).toBe('120');
    expect(result.filename).toBe('retry-after.txt');
  });

  it('builds and canonicalizes an HTTP-date', () => {
    const result = run('', { mode: 'build', form: 'date', date: 'Wed, 21 Oct 2015 07:28:00 GMT' });
    expect(result.output).toBe('Wed, 21 Oct 2015 07:28:00 GMT');
    expect(result.stats?.form).toBe('HTTP-date');
  });

  it('parses seconds and HTTP dates', () => {
    const result = run('120\nWed, 21 Oct 2015 07:28:00 GMT');
    expect(rows(result)[0]?.[1]).toBe('delta-seconds');
    expect(rows(result)[1]?.[1]).toBe('HTTP-date');
    expect(result.stats).toMatchObject({ values: 2, invalid: 0 });
  });

  it('flags huge delays and rejects malformed values', () => {
    const result = run('999999999999999999999\nnext Tuesday\n-1');
    expect(result.stats?.values).toBe(3);
    expect(result.stats?.invalid).toBe(2);
    expect(rows(result)[0]?.[3]).toContain('32-bit');
  });

  it('validates generated ranges and HTTP date form', () => {
    expect(() => run('', { mode: 'build', form: 'seconds', seconds: -1 })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', form: 'seconds', seconds: 1.5 })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', form: 'date', date: '2025-01-01' })).toThrow(ToolError);
  });

  it('returns guidance for blank parsing input', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
