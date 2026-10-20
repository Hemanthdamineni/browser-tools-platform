import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './if-range.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];
const DATE = 'Wed, 21 Oct 2015 07:28:00 GMT';

describe('if-range', () => {
  it('builds a strong entity-tag validator', () => {
    const result = run('', { mode: 'build', validator: '"v1-abc123"' });
    expect(result.output).toBe('"v1-abc123"');
    expect(result.filename).toBe('if-range.txt');
  });

  it('accepts strong tags and IMF-fixdates', () => {
    expect(run('"v1"').stats).toMatchObject({ validators: 1, invalid: 0, review: 0 });
    expect(run(DATE).stats).toMatchObject({ invalid: 0, review: 0 });
    expect(rows(run(DATE))[0]?.[2]).toBe('IMF-fixdate');
  });

  it('rejects weak tags and malformed validators', () => {
    const weak = run('W/"v1"');
    expect(weak.stats?.review).toBe(1);
    expect(rows(weak)[0]?.[3]).toContain('Weak');
    expect(run('not-a-validator').stats?.invalid).toBe(1);
  });

  it('rejects invalid generated validators', () => {
    expect(() => run('', { mode: 'build', validator: 'W/"v1"' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', validator: 'not valid' })).toThrow(ToolError);
  });

  it('handles blank analysis input with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('builds a date validator', () => {
    expect(run('', { mode: 'build', validator: DATE }).output).toBe(DATE);
  });
});
