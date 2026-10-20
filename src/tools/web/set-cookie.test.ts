import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './set-cookie.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('set-cookie', () => {
  it('builds a secure Set-Cookie header with attributes', () => {
    const result = run('', {
      mode: 'build',
      name: 'session',
      value: 'opaque-token',
      path: '/',
      sameSite: 'Lax',
      secure: true,
      httpOnly: true,
      maxAge: 3600,
    });
    expect(result.output).toBe(
      'session=opaque-token; Path=/; SameSite=Lax; Max-Age=3600; Secure; HttpOnly',
    );
    expect(result.filename).toBe('set-cookie.txt');
  });

  it('analyzes a secure cookie without findings', () => {
    const result = run('session=abc; Path=/; Secure; HttpOnly; SameSite=Lax');
    expect(rows(result)[0]?.[1]).toBe('Looks secure');
    expect(result.stats).toMatchObject({ cookies: 1, review: 0, secure: 1 });
  });

  it('flags missing protections and SameSite=None without Secure', () => {
    const result = run('session=abc; SameSite=None');
    expect(rows(result)[0]?.[1]).toBe('Review');
    expect(rows(result)[0]?.[3]).toContain('Missing Secure');
    expect(rows(result)[0]?.[3]).toContain('SameSite=None requires Secure');
  });

  it('handles multiple lines, malformed input, and values containing equals', () => {
    const result = run(
      'a=one=two; Secure; HttpOnly; SameSite=Strict; Path=/\nbad line\nb=2; Secure; HttpOnly; SameSite=Lax; Path=/',
    );
    expect(rows(result)).toHaveLength(3);
    expect(rows(result)[0]?.[2]).toBe('one=two');
    expect(rows(result)[1]?.[1]).toBe('Invalid');
    expect(result.stats?.review).toBe(1);
  });

  it('rejects unsafe generated values and invalid options', () => {
    expect(() => run('', { mode: 'build', value: 'a;b' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', name: 'bad name' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', sameSite: 'None', secure: false })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', maxAge: -1 })).toThrow(ToolError);
  });

  it('returns guidance for blank analysis input', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
