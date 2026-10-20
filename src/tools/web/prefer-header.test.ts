import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './prefer-header.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('prefer-header', () => {
  it('builds standard and custom preferences', () => {
    expect(run('', { mode: 'build', preference: 'return=minimal' }).output).toBe('return=minimal');
    expect(run('', { mode: 'build', custom: 'handling=strict' }).output).toBe('handling=strict');
  });

  it('parses quoted values and wait seconds', () => {
    const result = run('return=minimal, respond-async, wait=30, handling="strict mode"');
    expect(result.stats).toMatchObject({ preferences: 4, invalid: 0, duplicates: 'no' });
    expect(rows(result)).toContainEqual(['wait=30', 'wait', '30', '']);
    expect(rows(result)).toContainEqual(['handling="strict mode"', 'handling', 'strict mode', '']);
  });

  it('flags invalid wait and duplicate names', () => {
    const result = run('wait=90000, wait=30, wait=abc');
    expect(result.stats?.duplicates).toBe('yes');
    expect(result.stats?.invalid).toBe(3);
    expect(rows(result)[0]?.[3]).toContain('86400');
  });

  it('rejects invalid generated custom preferences', () => {
    expect(() => run('', { mode: 'build', custom: '' })).not.toThrow();
    expect(() => run('', { mode: 'build', custom: 'bad name=value' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', custom: 'wait=99999' })).toThrow(ToolError);
  });

  it('handles blank analysis input with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('preserves commas inside quoted values', () => {
    const result = run('handling="strict, mode"');
    expect(rows(result)).toContainEqual([
      'handling="strict, mode"',
      'handling',
      'strict, mode',
      '',
    ]);
  });
});
