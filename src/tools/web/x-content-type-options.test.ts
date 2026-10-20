import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './x-content-type-options.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('x-content-type-options', () => {
  it('builds the nosniff header', () => {
    const result = run('', { mode: 'build', value: 'nosniff' });
    expect(result.output).toBe('X-Content-Type-Options: nosniff');
    expect(result.filename).toBe('x-content-type-options.txt');
  });

  it('analyzes nosniff as valid', () => {
    const result = run('nosniff');
    expect(result.stats).toMatchObject({ valid: 'yes' });
    expect(rows(result)[0]?.[2]).toContain('prevents MIME sniffing');
  });

  it('flags non-standard values', () => {
    const result = run('gzip');
    expect(result.stats?.valid).toBe('no');
    expect(rows(result)[0]?.[1]).toBe('Invalid');
  });

  it('rejects none in build mode and invalid generated values', () => {
    expect(() => run('', { mode: 'build', value: 'none' })).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('accepts case-insensitive nosniff', () => {
    const result = run('NOSNIFF');
    expect(result.stats?.valid).toBe('yes');
  });
});
