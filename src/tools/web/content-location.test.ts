import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './content-location.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('content-location', () => {
  it('builds an absolute or relative Content-Location value', () => {
    const result = run('', { mode: 'build', location: '/representations/report.en.html' });
    expect(result.output).toBe('/representations/report.en.html');
    expect(result.filename).toBe('content-location.txt');
  });

  it('classifies absolute, relative, and network-path references', () => {
    const result = run(
      'https://example.com/report\n/representations/report.json\n//cdn.example.com/report',
    );
    expect(rows(result)[0]?.[1]).toBe('absolute URI');
    expect(rows(result)[1]?.[1]).toBe('relative URI reference');
    expect(rows(result)[2]?.[1]).toBe('network-path reference');
    expect(result.stats?.invalid).toBe(0);
  });

  it('warns about fragments', () => {
    const result = run('/report.html#section');
    expect(result.stats?.warnings).toBe(1);
    expect(rows(result)[0]?.[2]).toContain('Fragment');
  });

  it('rejects whitespace, controls, and malformed absolute URLs', () => {
    const result = run('bad value\nhttps://[bad\n');
    expect(result.stats?.invalid).toBe(2);
    expect(() => run('', { mode: 'build', location: 'bad value' })).toThrow(ToolError);
  });

  it('returns guidance for blank analysis input', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('rejects empty generated locations', () => {
    expect(() => run('', { mode: 'build', location: '' })).toThrow(ToolError);
  });
});
