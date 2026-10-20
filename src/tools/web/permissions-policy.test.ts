import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './permissions-policy.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('permissions-policy', () => {
  it('builds a feature allowlist', () => {
    const result = run('', {
      mode: 'build',
      feature: 'camera',
      allowlist: 'self "https://video.example"',
    });
    expect(result.output).toBe('camera=(self "https://video.example")');
    expect(result.filename).toBe('permissions-policy.txt');
  });

  it('analyzes valid directives and disabled features', () => {
    const result = run('camera=(self "https://video.example"), geolocation=()');
    expect(result.stats).toMatchObject({ directives: 2, issues: 0, disabled: 1 });
    expect(rows(result)[1]?.[1]).toBe('(empty)');
  });

  it('flags duplicate and broad grants', () => {
    const result = run('camera=(*), camera=(self)');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('Wildcard');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', feature: '', allowlist: 'self' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', feature: 'camera', allowlist: 'bad origin' })).toThrow(
      ToolError,
    );
  });

  it('handles malformed input and blank analysis', () => {
    expect(rows(run('camera=self'))[0]?.[2]).toBeUndefined();
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('rejects none combined with another origin', () => {
    const result = run('camera=(none self)');
    expect(result.stats?.issues).toBe(1);
  });
});
