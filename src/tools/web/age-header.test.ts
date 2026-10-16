import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './age-header.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;

describe('age-header', () => {
  it('builds an Age header', () => {
    const result = run('', { mode: 'build', seconds: '120' });
    expect(result.output).toBe('Age: 120');
    expect(result.filename).toBe('age-header.txt');
  });

  it('analyzes a valid value', () => {
    const result = run('120');
    expect(result.stats).toMatchObject({ valid: 'yes', age: 120 });
  });

  it('flags negative and non-integer values', () => {
    expect(() => run('-5')).toThrow(ToolError);
    expect(() => run('1.5')).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('classifies long cache age as stale', () => {
    const result = run('700000');
    expect(result.stats?.status).toBe('stale');
    expect(result.notes?.[0]).toContain('Cache-Control');
  });

  it('classifies zero as fresh', () => {
    const result = run('0');
    expect(result.stats?.status).toBe('fresh');
  });

  it('rounds a large value with advice', () => {
    const result = run('604801');
    expect(result.stats?.status).toBe('stale');
  });
});
