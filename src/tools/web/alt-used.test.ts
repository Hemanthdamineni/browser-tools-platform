import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './alt-used.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('alt-used', () => {
  it('builds a host:port header', () => {
    const result = run('', { mode: 'build', value: 'h2.example.com:443' });
    expect(result.output).toBe('Alt-Used: h2.example.com:443');
    expect(result.filename).toBe('alt-used.txt');
  });

  it('builds a bare host header', () => {
    const result = run('', { mode: 'build', value: 'edge.example.net' });
    expect(result.output).toBe('Alt-Used: edge.example.net');
  });

  it('analyzes a valid value', () => {
    const result = run('h3.example.com:443');
    expect(result.stats).toMatchObject({ valid: 'yes', host: 'h3.example.com', port: '443' });
    expect(rows(result)[0]?.[2]).toBe('Valid');
  });

  it('flags out-of-range ports and URLs', () => {
    const result = run('https://example.com:99999');
    expect(result.stats?.valid).toBe('no');
    expect(result.notes?.join(' ')).toContain('URL');
  });

  it('rejects wildcard in build and empty values', () => {
    expect(() => run('', { mode: 'build', value: '*' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', value: '' })).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
