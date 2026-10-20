import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './content-security-policy.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('content-security-policy', () => {
  it('builds a strict policy', () => {
    const result = run('', {
      mode: 'build',
      defaultSrc: "'self'",
      scriptSrc: "'self'",
      imgSrc: "'self' data:",
      frameAncestors: "'none'",
    });
    expect(result.output).toContain("default-src 'self'");
    expect(result.output).toContain("frame-ancestors 'none'");
    expect(result.filename).toBe('content-security-policy.txt');
  });

  it('rejects unsafe generated values', () => {
    expect(() => run('', { mode: 'build', scriptSrc: "'unsafe-inline'" })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', defaultSrc: '' })).toThrow(ToolError);
  });

  it('analyzes a strict policy without issues', () => {
    const result = run("default-src 'self'; script-src 'self'; img-src 'self' data:");
    expect(result.stats?.issues).toBe(0);
    expect(result.stats?.directives).toBe(3);
    expect(rows(result)[0]?.[2]).toBe('Valid');
  });

  it('flags unsafe keywords, unknown and duplicate directives', () => {
    const result = run(
      "default-src 'self'; script-src 'unsafe-inline'; script-src 'unsafe-eval'; bogus-src 'none'",
    );
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('Unsafe');
    expect(result.notes?.join(' ')).toContain('Duplicate');
    expect(result.notes?.join(' ')).toContain('Unknown');
  });

  it('advises adding a default-src when missing', () => {
    const result = run("script-src 'self'");
    expect(result.notes?.join(' ')).toContain('default-src');
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
