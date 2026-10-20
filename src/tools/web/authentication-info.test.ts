import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './authentication-info.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('authentication-info', () => {
  it('builds a quoted nextnonce parameter', () => {
    const result = run('', { mode: 'build', parameter: 'nextnonce', value: 'server-nonce' });
    expect(result.output).toBe('nextnonce="server-nonce"');
    expect(result.filename).toBe('authentication-info.txt');
  });

  it('parses quoted values and nonce counts', () => {
    const result = run('nextnonce="server-nonce", rspauth="abc123", nc=00000001');
    expect(result.stats).toMatchObject({ parameters: 3, issues: 0, invalid: 0 });
    expect(rows(result)[2]?.[1]).toBe('00000001');
  });

  it('flags duplicate, unknown, and invalid nonce-count parameters', () => {
    const result = run('nc=1, nc=00000001, mystery=value');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.stats?.invalid).toBeGreaterThan(0);
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', parameter: 'nc', value: '1' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', parameter: 'unknown', value: 'x' })).toThrow(ToolError);
  });

  it('handles malformed input and blank analysis', () => {
    expect(rows(run('broken'))[0]?.[2]).toBeUndefined();
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('escapes generated quoted values', () => {
    expect(run('', { mode: 'build', parameter: 'rspauth', value: 'a"b' }).output).toBe(
      'rspauth="a\\"b"',
    );
  });
});
