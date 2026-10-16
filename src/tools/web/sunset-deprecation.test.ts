import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './sunset-deprecation.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;

describe('sunset-deprecation', () => {
  it('builds a Sunset header with link', () => {
    const result = run('', { mode: 'build', header: 'sunset', date: 'Wed, 15 Mar 2028 00:00:00 GMT', link: 'https://api.example.com/docs/deprecation' });
    expect(result.output).toBe('Sunset: Wed, 15 Mar 2028 00:00:00 GMT; Link=<https://api.example.com/docs/deprecation>');
    expect(result.filename).toBe('sunset.txt');
  });

  it('builds a Deprecation header without link', () => {
    const result = run('', { mode: 'build', header: 'deprecation', date: 'Wed, 15 Mar 2028 00:00:00 GMT', link: '' });
    expect(result.output).toBe('Deprecation: Wed, 15 Mar 2028 00:00:00 GMT');
    expect(result.filename).toBe('deprecation.txt');
  });

  it('analyzes a full Sunset header line', () => {
    const result = run('Sunset: Wed, 15 Mar 2028 00:00:00 GMT');
    expect(result.stats?.lines).toBe(1);
    expect(result.stats?.invalid).toBe(0);
    expect(result.stats?.review).toBe(0);
    expect(result.notes?.[0]).toContain('announces');
  });

  it('flags past dates and invalid formats', () => {
    const result = run('Sunset: Wed, 15 Mar 2020 00:00:00 GMT\nDeprecation: not-a-date');
    expect(result.stats?.invalid).toBeGreaterThan(0);
    expect(result.stats?.review).toBeGreaterThan(0);
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', header: 'sunset', date: 'not a date', link: '' })).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});