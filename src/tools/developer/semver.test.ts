import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './semver.tool';

type Result = { output: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('semver', () => {
  it('validates strict SemVer and rejects prefixes or leading zeroes', () => {
    const result = run('1.2.3\n2.0.0-rc.1\n1.0.0+build.7\nv1.2.3\n01.2.3');
    expect(result.stats).toMatchObject({ checked: 5, valid: 3, invalid: 2 });
    expect(
      rows(result)
        .slice(-2)
        .map((row) => row[1]),
    ).toEqual(['Invalid', 'Invalid']);
  });

  it('sorts prereleases according to SemVer precedence and preserves build metadata', () => {
    const result = run(
      '1.0.0\n1.0.0-rc.1\n1.0.0-alpha.2\n1.0.0-alpha.10\n1.0.0-alpha\n1.0.0+build.4',
      { mode: 'sort' },
    );
    expect(result.output.split('\n')).toEqual([
      '1.0.0-alpha',
      '1.0.0-alpha.2',
      '1.0.0-alpha.10',
      '1.0.0-rc.1',
      '1.0.0',
      '1.0.0+build.4',
    ]);
  });

  it('sorts descending', () => {
    const result = run('2.0.0\n1.0.0\n1.5.0', { mode: 'sort', descending: true });
    expect(result.output).toBe('2.0.0\n1.5.0\n1.0.0');
  });

  it('compares prerelease with release and ignores build metadata', () => {
    expect(run('1.0.0-rc.1', { mode: 'compare', secondVersion: '1.0.0' }).output).toContain(
      'less than',
    );
    expect(run('1.0.0+one', { mode: 'compare', secondVersion: '1.0.0+two' }).output).toContain(
      'equal precedence',
    );
  });

  it('enforces compare and sort input contracts', () => {
    expect(() => run('1.0.0\n2.0.0', { mode: 'compare', secondVersion: '2.0.0' })).toThrow(
      ToolError,
    );
    expect(() => run('1.0.0\ninvalid', { mode: 'sort' })).toThrow(ToolError);
    expect(() => run('1.0.0', { mode: 'other' })).toThrow(ToolError);
  });

  it('handles empty validation input without crashing', () => {
    expect(run('').stats?.checked).toBe(0);
  });
});
