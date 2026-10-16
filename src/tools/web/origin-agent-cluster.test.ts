import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './origin-agent-cluster.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('origin-agent-cluster', () => {
  it('builds an origin-keyed signal', () => {
    const result = run('', { mode: 'build', value: '?1' });
    expect(result.output).toBe('?1');
    expect(result.filename).toBe('origin-agent-cluster.txt');
  });

  it('analyzes origin-keyed and opt-out values', () => {
    expect(run('?1').stats).toMatchObject({ valid: 'yes', originKeyed: 'yes', issues: 0 });
    expect(rows(run('?0'))[0]?.[2]).toContain('Opts out');
  });

  it('rejects invalid structured values', () => {
    const result = run('true');
    expect(result.stats?.valid).toBe('no');
    expect(rows(result)[0]?.[2]).toContain('structured boolean');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', value: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', value: '1' })).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('trims valid generated values', () => {
    expect(run('', { mode: 'build', value: ' ?1 ' }).output).toBe('?1');
  });
});
