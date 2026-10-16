import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './traceparent.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];
const VALID = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

describe('traceparent', () => {
  it('builds a sampled traceparent', () => {
    const result = run('', { mode: 'build', version: '00', traceId: '4bf92f3577b34da6a3ce929d0e0e4736', parentId: '00f067aa0ba902b7', flags: '01' });
    expect(result.output).toBe(VALID);
    expect(result.filename).toBe('traceparent.txt');
  });

  it('analyzes valid propagation values', () => {
    const result = run(VALID);
    expect(result.stats).toMatchObject({ valid: 'yes', issues: 0, sampled: 'yes' });
    expect(rows(result)[0]?.[1]).toBe('Valid');
  });

  it('rejects malformed and all-zero identifiers', () => {
    const result = run('00-00000000000000000000000000000000-00f067aa0ba902b7-01');
    expect(result.stats?.valid).toBe('no');
    expect(rows(result)[0]?.[2]).toContain('Trace ID');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', version: '0', traceId: 'a', parentId: 'b', flags: '0' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', version: '00', traceId: '0'.repeat(32), parentId: '00f067aa0ba902b7', flags: '01' })).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('recognizes an unsampled flag', () => {
    expect(run(VALID.replace(/-01$/, '-00')).stats?.sampled).toBe('no');
  });
});
