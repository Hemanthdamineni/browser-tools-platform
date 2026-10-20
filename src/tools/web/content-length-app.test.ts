import { describe, expect, it } from 'vitest';
import tool from './content-length-app.tool';

type Result = { output: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;

describe('content-length-app', () => {
  it('counts ASCII bytes exactly', () => {
    const result = run('hello');
    expect(result.stats?.bytes).toBe(5);
    expect(result.stats?.chars).toBe(5);
  });

  it('counts multi-byte UTF-8 correctly and flags mismatch', () => {
    const result = run('héllo 🎉');
    expect(result.stats?.bytes).toBeGreaterThan(result.stats?.chars as number);
    expect(result.notes?.[0]).toContain('multi-byte');
  });

  it('verifies a matching declared value', () => {
    const result = run('🎉', { mode: 'verify', declared: '4' });
    expect(result.stats).toMatchObject({ match: 'yes', bytes: 4, declared: 4 });
  });

  it('flags an undersized declared value', () => {
    const result = run('héllo me', { mode: 'verify', declared: '3' });
    expect(result.stats?.match).toBe('no');
    expect(result.notes?.[0]).toContain('underestimates');
  });

  it('flags an oversized declared value', () => {
    const result = run('hi', { mode: 'verify', declared: '50' });
    expect(result.stats?.match).toBe('no');
    expect(result.notes?.[0]).toContain('overestimates');
  });

  it('reports invalid declared values and normalizes CRLF', () => {
    const result = run('a\nb', { mode: 'verify', declared: 'nan' });
    expect(result.stats?.declared).toBe('invalid');
    expect(run('a\r\nb').stats?.bytes).toBe(3);
  });
});
