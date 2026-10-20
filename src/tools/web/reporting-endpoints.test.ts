import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './reporting-endpoints.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('reporting-endpoints', () => {
  it('builds a default endpoint', () => {
    const result = run('', {
      mode: 'build',
      name: 'default',
      url: 'https://reports.example.com/collect',
    });
    expect(result.output).toBe('default="https://reports.example.com/collect"');
    expect(result.filename).toBe('reporting-endpoints.txt');
  });

  it('builds an endpoint with priority', () => {
    const result = run('', {
      mode: 'build',
      name: 'main',
      url: 'https://reports.example.com/csp',
      priority: '2',
    });
    expect(result.output).toBe('main="https://reports.example.com/csp"; priority=2');
    expect(result.stats).toMatchObject({ groups: 1, https: 'yes' });
  });

  it('analyzes multiple groups', () => {
    const result = run(
      'default="https://a.example.com/r", main="https://b.example.com/r"; priority=2',
    );
    expect(result.stats?.groups).toBe(2);
    expect(rows(result).every((row) => row[3] === 'Valid')).toBe(true);
  });

  it('flags duplicate groups and http non-localhost URLs', () => {
    const result = run('default="http://a.example.com/r", default="https://b.example.com/r"');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('Duplicate');
    expect(result.notes?.join(' ')).toContain('https');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', name: '', url: '' })).toThrow(ToolError);
    expect(() =>
      run('', {
        mode: 'build',
        name: 'default',
        url: 'http://reports.example.com/x',
        priority: '500',
      }),
    ).toThrow(ToolError);
  });

  it('handles blank analysis and malformed groups with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
    expect(rows(run('broken'))[0]?.[3]).toBe('Review');
  });
});
