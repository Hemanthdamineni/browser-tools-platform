import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './security-headers.tool';

type Result = { output: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string) => tool.run({ text, options: {} }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('security-headers', () => {
  it('recognizes a reasonable header set and reports status line', () => {
    const result = run([
      'HTTP/1.1 200 OK',
      "Content-Security-Policy: default-src 'self'; object-src 'none'; frame-ancestors 'none'",
      'Strict-Transport-Security: max-age=31536000; includeSubDomains',
      'X-Content-Type-Options: nosniff',
      'Referrer-Policy: strict-origin-when-cross-origin',
      "Permissions-Policy: geolocation=(), camera=()",
    ].join('\r\n'));
    expect(result.notes?.some((note) => note.includes('HTTP/1.1 200'))).toBe(true);
    expect(rows(result).find((row) => row[0] === 'Content-Security-Policy')?.[1]).toBe('Present');
    expect(rows(result).find((row) => row[0] === 'X-Content-Type-Options')?.[1]).toBe('Present');
  });

  it('flags missing protections on a sparse block', () => {
    const result = run('HTTP/1.1 200 OK\nServer: example');
    expect(result.stats?.missing).toBe(6);
    expect(rows(result).some((row) => row[0] === 'Referrer-Policy' && row[1] === 'Missing')).toBe(true);
  });

  it('reviews unsafe CSP sources and weak HSTS values', () => {
    const result = run("Content-Security-Policy: default-src *; script-src 'unsafe-inline'\nStrict-Transport-Security: max-age=60");
    expect(rows(result).find((row) => row[0] === 'Content-Security-Policy')?.[1]).toBe('Review');
    expect(rows(result).find((row) => row[0] === 'Strict-Transport-Security')?.[1]).toBe('Review');
  });

  it('reports duplicate headers and ignores malformed lines', () => {
    const result = run('X-Content-Type-Options: nosniff\nx-content-type-options: nope\nnot a header');
    expect(result.stats?.duplicates).toBe(1);
    expect(result.stats?.malformed).toBe(1);
    expect(result.notes?.some((note) => note.includes('Duplicate header'))).toBe(true);
    expect(result.notes?.some((note) => note.includes('malformed'))).toBe(true);
  });

  it('accepts header casing and bare header blocks', () => {
    const result = run('content-security-policy: default-src \'self\'\nX-FRAME-OPTIONS: DENY\nreferrer-policy: no-referrer');
    expect(rows(result).find((row) => row[0] === 'Content-Security-Policy')?.[1]).toBe('Present');
    expect(rows(result).some((row) => row[0] === 'Framing protection')).toBe(false);
  });

  it('returns empty-input guidance and bounds input size', () => {
    expect(run('').notes?.[0]).toContain('Paste');
    expect(() => run('x'.repeat(200_001))).toThrow(ToolError);
  });
});
