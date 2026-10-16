import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './forwarded-header.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('forwarded-header', () => {
  it('builds a Forwarded element with optional parameters', () => {
    const result = run('', { mode: 'build', forValue: '192.0.2.43', byValue: '203.0.113.10', host: 'example.com', proto: 'https' });
    expect(result.output).toBe('for=192.0.2.43;by=203.0.113.10;host=example.com;proto=https');
    expect(result.filename).toBe('forwarded.txt');
  });

  it('quotes values containing spaces and parses multiple elements', () => {
    const result = run('for=192.0.2.43;proto=https;host="example.com", for=_hidden;by="edge one"');
    expect(result.stats).toMatchObject({ elements: 2, invalid: 0 });
    expect(rows(result)).toContainEqual(['1', 'host', 'example.com', '']);
    expect(rows(result)).toContainEqual(['2', 'by', 'edge one', '']);
  });

  it('flags missing for and duplicate parameters', () => {
    const result = run('proto=https;host=example.com\nfor=one;for=two');
    expect(result.stats?.invalid).toBe(2);
    expect(rows(result)[0]?.[3]).toContain('Missing required for');
    expect(rows(result).some((row) => row[3]?.includes('Duplicate'))).toBe(true);
  });

  it('rejects unsafe generated values', () => {
    expect(() => run('', { mode: 'build', forValue: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', forValue: 'one,two' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', proto: 'ftp' })).toThrow(ToolError);
  });

  it('handles empty input with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('preserves obfuscated identifiers as opaque values', () => {
    const result = run('for=_opaque123;by="[2001:db8::1]"');
    expect(rows(result)).toContainEqual(['1', 'for', '_opaque123', '']);
    expect(rows(result)).toContainEqual(['1', 'by', '[2001:db8::1]', '']);
  });
});
