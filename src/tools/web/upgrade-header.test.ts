import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './upgrade-header.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('upgrade-header', () => {
  it('builds a normalized protocol declaration', () => {
    const result = run('', { mode: 'build', protocols: 'WebSocket' });
    expect(result.output).toBe('websocket');
    expect(result.filename).toBe('upgrade.txt');
  });

  it('parses protocol versions', () => {
    const result = run('websocket, h2c/1.0');
    expect(result.stats).toMatchObject({ protocols: 2, issues: 0, duplicates: 'no' });
    expect(rows(result)[1]).toEqual(['h2c', '1.0', 'Valid', '']);
  });

  it('flags duplicate protocols and HTTP version limitations', () => {
    const result = run('websocket, websocket, HTTP/2.0');
    expect(result.stats?.duplicates).toBe('yes');
    expect(result.notes?.[0]).toContain('Connection');
    expect(rows(result).some((row) => row[3]?.includes('HTTP/2'))).toBe(true);
  });

  it('rejects invalid generated protocols', () => {
    expect(() => run('', { mode: 'build', protocols: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', protocols: 'bad protocol' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', protocols: 'websocket/a/b' })).toThrow(ToolError);
  });

  it('handles malformed values and blank input', () => {
    expect(rows(run('bad protocol'))[0]?.[2]).toBe('Review');
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('preserves explicit protocol versions', () => {
    expect(run('', { mode: 'build', protocols: 'h2c/1.0' }).output).toBe('h2c/1.0');
  });
});
