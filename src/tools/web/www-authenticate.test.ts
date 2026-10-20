import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './www-authenticate.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('www-authenticate', () => {
  it('builds Basic and Bearer challenges', () => {
    expect(run('', { mode: 'build', scheme: 'Basic', realm: 'Members' }).output).toBe(
      'Basic realm="Members"',
    );
    expect(
      run('', {
        mode: 'build',
        scheme: 'Bearer',
        realm: 'api',
        scope: 'read write',
        error: 'invalid_token',
      }).output,
    ).toBe('Bearer realm="api", scope="read write", error="invalid_token"');
  });

  it('parses quoted parameters and multiple challenges', () => {
    const result = run('Basic realm="Members", Bearer realm="api", scope="read write"');
    expect(result.stats).toMatchObject({ challenges: 2, invalid: 0, review: 0 });
    expect(rows(result)).toContainEqual(['Basic', 'realm', 'Members', '']);
    expect(rows(result)).toContainEqual(['Bearer', 'scope', 'read write', '']);
  });

  it('flags duplicate parameters and malformed challenges', () => {
    const result = run('Bearer realm="api", realm="other"\nnot valid');
    expect(result.stats?.review).toBeGreaterThan(0);
    expect(rows(result).some((row) => row[3]?.includes('Duplicate'))).toBe(true);
  });

  it('rejects unsafe generated values and unsupported schemes', () => {
    expect(() => run('', { mode: 'build', realm: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', scheme: 'Digest' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', scope: 'read\nwrite' })).toThrow(ToolError);
  });

  it('returns guidance for blank parsing input', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('preserves escaped quoted values', () => {
    const result = run('Basic realm="A \\"quoted\\" realm"');
    expect(rows(result)).toContainEqual(['Basic', 'realm', 'A "quoted" realm', '']);
  });
});
