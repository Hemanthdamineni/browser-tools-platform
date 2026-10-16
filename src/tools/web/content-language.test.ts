import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './content-language.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('content-language', () => {
  it('builds a normalized language header', () => {
    const result = run('', { mode: 'build', tags: 'en-US, fr-CA' });
    expect(result.output).toBe('en-US, fr-CA');
    expect(result.filename).toBe('content-language.txt');
  });

  it('accepts common language, script, region, and wildcard tags', () => {
    const result = run('en-US, zh-Hant-TW, fr');
    expect(result.stats).toMatchObject({ tags: 3, issues: 0, wildcard: 'no' });
    expect(rows(result)[1]?.[1]).toBe('Valid');
    expect(run('*').stats?.wildcard).toBe('yes');
  });

  it('flags malformed tags, duplicates, and wildcard combinations', () => {
    const result = run('en-US, EN-us, *, not_a_language');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('Wildcard');
  });

  it('flags private-use tags for review', () => {
    const result = run('de-x-company');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(rows(result)[0]?.[2]).toContain('Private-use');
  });

  it('rejects invalid generated tags', () => {
    expect(() => run('', { mode: 'build', tags: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', tags: 'en_US' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', tags: 'en, en' })).toThrow(ToolError);
  });

  it('returns guidance for blank analysis input', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
