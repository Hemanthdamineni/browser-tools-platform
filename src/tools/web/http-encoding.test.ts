import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './http-encoding.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('http-encoding', () => {
  it('builds Accept-Encoding and Content-Encoding values', () => {
    expect(run('', { mode: 'build', header: 'accept', codings: 'br, gzip, deflate' }).output).toBe('br, gzip, deflate');
    expect(run('', { mode: 'build', header: 'content', codings: 'gzip' }).output).toBe('gzip');
  });

  it('parses q-values and selects a preferred supported coding', () => {
    const result = run('br;q=1.0, gzip;q=0.8, *;q=0.1', { supported: 'gzip, identity' });
    expect(rows(result)[0]).toEqual(['br', '1', 'gzip', '']);
    expect(result.stats?.preferred).toBe('gzip');
  });

  it('flags invalid q-values and parameters', () => {
    const result = run('gzip;q=1.5, br;level=9, broken token');
    expect(result.stats?.invalid).toBe(3);
    expect(rows(result)[0]?.[3]).toContain('q must');
  });

  it('handles q=0 and no acceptable supported coding', () => {
    const result = run('gzip;q=0, br;q=0', { supported: 'gzip, br' });
    expect(result.stats?.preferred).toBe('none');
  });

  it('rejects invalid generated coding lists', () => {
    expect(() => run('', { mode: 'build', codings: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', codings: 'gzip;bad' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', header: 'other' })).toThrow(ToolError);
  });

  it('returns guidance for blank analysis input', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
