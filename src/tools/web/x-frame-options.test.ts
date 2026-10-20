import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './x-frame-options.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('x-frame-options', () => {
  it('builds a strict frame policy', () => {
    const result = run('', { mode: 'build', value: 'DENY' });
    expect(result.output).toBe('DENY');
    expect(result.filename).toBe('x-frame-options.txt');
  });

  it('analyzes DENY and SAMEORIGIN', () => {
    expect(run('DENY').stats).toMatchObject({ valid: 'yes', value: 'DENY' });
    expect(rows(run('SAMEORIGIN'))[0]?.[2]).toContain('same origin');
  });

  it('flags ALLOW-FROM as deprecated', () => {
    const result = run('ALLOW-FROM https://example.com');
    expect(result.stats?.valid).toBe('no');
    expect(result.notes?.join(' ')).toContain('deprecated');
  });

  it('rejects unsupported values', () => {
    const result = run('SAMEORIGIN2');
    expect(result.stats?.valid).toBe('no');
    expect(rows(result)[0]?.[1]).toBe('Invalid');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', value: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', value: 'ALLOW-FROM https://x' })).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
