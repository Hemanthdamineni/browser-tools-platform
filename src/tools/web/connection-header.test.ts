import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './connection-header.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('connection-header', () => {
  it('builds normalized connection tokens', () => {
    const result = run('', { mode: 'build', tokens: 'Keep-Alive, Upgrade' });
    expect(result.output).toBe('keep-alive, upgrade');
    expect(result.filename).toBe('connection.txt');
  });

  it('analyzes ordinary control tokens', () => {
    const result = run('keep-alive');
    expect(result.stats).toMatchObject({ tokens: 1, issues: 0, sensitive: 0 });
    expect(rows(result)[0]?.[1]).toBe('Valid');
  });

  it('flags duplicate, malformed, and proxy-sensitive tokens', () => {
    const result = run('Upgrade, upgrade, bad token, Authorization');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.stats?.sensitive).toBe(1);
    expect(result.notes?.join(' ')).toContain('proxy');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', tokens: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', tokens: 'bad token' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', tokens: 'Host' })).toThrow(ToolError);
  });

  it('handles blank analysis input with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('normalizes case and whitespace', () => {
    expect(run('', { mode: 'build', tokens: '  Upgrade ' }).output).toBe('upgrade');
  });
});
