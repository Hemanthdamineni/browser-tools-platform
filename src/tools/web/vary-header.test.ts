import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './vary-header.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('vary-header', () => {
  it('builds a normalized Vary header', () => {
    const result = run('', { mode: 'build', fields: 'Accept-Encoding, Origin' });
    expect(result.output).toBe('accept-encoding, origin');
    expect(result.filename).toBe('vary.txt');
  });

  it('analyzes valid fields and wildcard', () => {
    const result = run('Accept-Encoding, Origin');
    expect(result.stats).toMatchObject({ fields: 2, issues: 0, wildcard: 'no' });
    expect(rows(result)[0]?.[1]).toBe('Valid');
    expect(run('*').stats?.wildcard).toBe('yes');
  });

  it('flags wildcard combinations and duplicates', () => {
    const result = run('*, Origin, Origin');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('Wildcard');
  });

  it('flags authorization cache caveat and invalid fields', () => {
    const result = run('Authorization, Bad Field');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('authorization');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', fields: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', fields: '*, Origin' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', fields: 'Bad Field' })).toThrow(ToolError);
  });

  it('returns guidance for blank analysis input', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
