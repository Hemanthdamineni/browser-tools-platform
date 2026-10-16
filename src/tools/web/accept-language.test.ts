import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './accept-language.tool';

type Result = { output: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('accept-language', () => {
  it('analyzes a browser header and orders by q', () => {
    const result = run('Accept-Language: en-US, en;q=0.9, fr;q=0.7, *;q=0.5');
    expect(result.stats?.top).toBe('en-US');
    expect(result.notes?.[0]).toContain('Preference order');
  });

  it('assigns a uniform q in rank mode', () => {
    const result = run('de, ja, es', { mode: 'rank', defaultQuality: '0.9' });
    expect(result.stats?.ranges).toBe(3);
    expect(result.notes?.[0]).toContain('0.9');
    expect(rows(result).every((row) => row[1] === '0.9')).toBe(true);
  });

  it('flags malformed entries and duplicate ranges', () => {
    const result = run('en, en ; q=9, en');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('Duplicate');
  });

  it('flags invalid language ranges', () => {
    const result = run('en_US, 1234');
    expect(result.notes?.join(' ')).toContain('Invalid language range');
  });

  it('rejects an unsupported mode', () => {
    expect(() => run('en', { mode: 'nope' })).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
