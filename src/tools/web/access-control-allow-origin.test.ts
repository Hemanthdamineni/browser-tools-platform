import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './access-control-allow-origin.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('access-control-allow-origin', () => {
  it('builds a narrow origin grant', () => {
    const result = run('', { mode: 'build', origin: 'https://app.example.com', credentials: 'no' });
    expect(result.output).toBe('https://app.example.com');
    expect(result.filename).toBe('access-control-allow-origin.txt');
  });

  it('builds with credentials for a specific origin', () => {
    const result = run('', {
      mode: 'build',
      origin: 'https://app.example.com',
      credentials: 'yes',
    });
    expect(result.stats).toMatchObject({ wildcard: 'no', credentials: 'yes' });
  });

  it('rejects wildcard with credentials in build', () => {
    expect(() => run('', { mode: 'build', origin: '*', credentials: 'yes' })).toThrow(ToolError);
    expect(() =>
      run('', { mode: 'build', origin: 'javascript:alert(1)', credentials: 'no' }),
    ).toThrow(ToolError);
  });

  it('analyzes wildcard and specific origins', () => {
    const result = run('*');
    expect(result.stats).toMatchObject({ valid: 'yes', wildcard: 'yes' });
    expect(rows(run('https://app.example.com'))[0]?.[2]).toContain('only this origin');
  });

  it('flags multiple origins as invalid', () => {
    const result = run('https://a.example.com, https://b.example.com');
    expect(result.stats?.valid).toBe('no');
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
