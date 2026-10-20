import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './access-control-allow-credentials.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('access-control-allow-credentials', () => {
  it('builds the true header', () => {
    const result = run('', { mode: 'build', value: 'true' });
    expect(result.output).toBe('Access-Control-Allow-Credentials: true');
    expect(result.filename).toBe('access-control-allow-credentials.txt');
  });

  it('analyzes a valid true value', () => {
    const result = run('true');
    expect(result.stats).toMatchObject({ valid: 'yes', value: 'true' });
    expect(rows(result)[0]?.[2]).toContain('Allow');
  });

  it('flags false as non-standard', () => {
    const result = run('false');
    expect(result.stats?.valid).toBe('no');
    expect(result.notes?.join(' ')).toContain('omit');
  });

  it('rejects unknown values', () => {
    const result = run('yes');
    expect(result.stats?.valid).toBe('no');
    expect(rows(result)[0]?.[1]).toBe('Invalid');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', value: 'false' })).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
