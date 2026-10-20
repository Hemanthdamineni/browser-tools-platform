import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './server-timing.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('server-timing', () => {
  it('builds a metric with description and duration', () => {
    const result = run('', {
      mode: 'build',
      name: 'db',
      duration: 18.7,
      description: 'PostgreSQL query',
    });
    expect(result.output).toBe('db;desc="PostgreSQL query";dur=18.7');
    expect(result.filename).toBe('server-timing.txt');
  });

  it('parses quoted descriptions and numeric durations', () => {
    const result = run('cache;desc="Redis lookup";dur=2.4, db;dur=18.7, app;dur=4');
    expect(result.stats).toMatchObject({ metrics: 3, invalid: 0, duplicates: 'no' });
    expect(rows(result)).toContainEqual(['cache', 'desc', 'Redis lookup', '']);
    expect(rows(result)).toContainEqual(['db', 'dur', '18.7', '']);
  });

  it('flags malformed names, durations, unknown and duplicate parameters', () => {
    const result = run('bad name;dur=2\ndb;dur=-1\ncache;foo=bar;dur=1;dur=2');
    expect(result.stats?.invalid).toBe(1);
    expect(rows(result).some((row) => row[3]?.includes('dur must'))).toBe(true);
    expect(rows(result).some((row) => row[3]?.includes('Unknown'))).toBe(true);
  });

  it('rejects unsafe generated values', () => {
    expect(() => run('', { mode: 'build', name: 'bad name' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', duration: -1 })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', description: 'bad,desc' })).toThrow(ToolError);
  });

  it('handles blank input with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('preserves escaped quotes in descriptions', () => {
    const result = run('db;desc="query \\"users\\"";dur=2');
    expect(rows(result)).toContainEqual(['db', 'desc', 'query "users"', '']);
  });
});
