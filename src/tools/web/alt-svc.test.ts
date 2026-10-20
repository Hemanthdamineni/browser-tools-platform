import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './alt-svc.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('alt-svc', () => {
  it('builds an HTTP/3 alternate-service value', () => {
    const result = run('', { mode: 'build', protocol: 'h3', authority: ':443', maxAge: 86400 });
    expect(result.output).toBe('h3=":443"; ma=86400');
    expect(result.filename).toBe('alt-svc.txt');
  });

  it('analyzes valid services and quoted commas', () => {
    const result = run('h3=":443"; ma=86400, h3-29="alt.example:443"; persist=1');
    expect(result.stats).toMatchObject({ entries: 2, invalid: 0, review: 0 });
    expect(rows(result)[0]?.[2]).toBe('Valid');
  });

  it('flags wildcard, duplicate protocols, and invalid parameters', () => {
    const result = run('h3="*"; ma=40000000, h3=":443"; persist=0');
    expect(result.stats?.review).toBe(2);
    expect(rows(result)[0]?.[3]).toContain('Wildcard');
    expect(rows(result)[1]?.[3]).toContain('Duplicate');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', protocol: 'bad protocol' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', authority: 'not-an-authority' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', maxAge: 40000000 })).toThrow(ToolError);
  });

  it('handles malformed entries and blank input', () => {
    expect(rows(run('h3=broken'))[0]?.[2]).toBe('Invalid');
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('supports persist when enabled', () => {
    expect(run('', { mode: 'build', persist: true }).output).toContain('; persist=1');
  });
});
