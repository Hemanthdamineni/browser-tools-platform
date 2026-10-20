import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './strict-transport-security.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('strict-transport-security', () => {
  it('builds a basic policy', () => {
    const result = run('', { mode: 'build', maxAge: '31536000', flags: 'none' });
    expect(result.output).toBe('max-age=31536000');
    expect(result.filename).toBe('strict-transport-security.txt');
  });

  it('builds a preload-ready policy with subdomains', () => {
    const result = run('', {
      mode: 'build',
      maxAge: '31536000',
      flags: 'includeSubDomains+preload',
    });
    expect(result.output).toBe('max-age=31536000; includeSubDomains; preload');
    expect(result.stats).toMatchObject({ includeSubDomains: 'yes', preload: 'yes' });
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', maxAge: 'abc', flags: 'none' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', maxAge: '-100', flags: 'none' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', maxAge: '31536000', flags: 'weird' })).toThrow(ToolError);
  });

  it('analyzes a full valid policy', () => {
    const result = run('max-age=31536000; includeSubDomains; preload');
    expect(result.stats).toMatchObject({
      maxAge: 31536000,
      includeSubDomains: 'yes',
      preload: 'yes',
      issues: 0,
    });
    expect(rows(result)[0]?.[2]).toContain('preload minimum');
  });

  it('flags short max-age and preload without subdomains', () => {
    const result = run('max-age=1000; preload');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('one-year');
    expect(result.notes?.join(' ')).toContain('includeSubDomains');
  });

  it('reports missing max-age and unknown directives, guides blank input', () => {
    expect(rows(run('foo; bar'))[0]?.[1]).toBe('Missing');
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
