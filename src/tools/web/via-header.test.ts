import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './via-header.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('via-header', () => {
  it('builds a proxy Via header value', () => {
    const result = run('', { mode: 'build', protocol: 'HTTP/1.1', host: 'proxy.example.com' });
    expect(result.output).toBe('HTTP/1.1 proxy.example.com');
    expect(result.filename).toBe('via-header.txt');
    expect(result.stats?.gateways).toBe(1);
  });

  it('builds with a version-only protocol', () => {
    const result = run('', { mode: 'build', protocol: '1.0', host: 'cache' });
    expect(result.output).toBe('HTTP/1.0 cache');
  });

  it('analyzes a single valid element', () => {
    const result = run('1.0 example.com (Apache/2.4)');
    expect(result.stats).toMatchObject({ elements: 1, invalid: 0 });
    expect(rows(result)[0]?.[1]).toBe('Valid');
  });

  it('analyzes a proxy chain and respects commas in comments', () => {
    const result = run('1.1 vegur, 1.1 proxy, 1.0 cache (varnish, 4.0)');
    expect(result.stats?.elements).toBe(3);
    expect(result.stats?.invalid).toBe(0);
    expect(result.notes?.join(' ')).toContain('proxy chain');
  });

  it('flags invalid grammar', () => {
    const result = run('bogus, 1.1');
    expect(result.stats?.invalid).toBeGreaterThan(0);
    expect(rows(result)[0]?.[1]).toBe('Invalid');
  });

  it('rejects invalid build inputs and unsupported modes', () => {
    expect(() => run('', { mode: 'build', protocol: 'nope', host: 'x' })).toThrow(ToolError);
    expect(() => run('x', { mode: 'nope' })).toThrow(ToolError);
  });
});
