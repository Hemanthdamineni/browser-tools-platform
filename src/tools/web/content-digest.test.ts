import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './content-digest.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];
const SHA256 = '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=';

describe('content-digest', () => {
  it('builds a structured SHA-256 digest field', () => {
    const result = run('', { mode: 'build', algorithm: 'sha-256', digest: SHA256 });
    expect(result.output).toBe(`sha-256=:${SHA256}:`);
    expect(result.filename).toBe('content-digest.txt');
  });

  it('analyzes valid SHA-256 and SHA-512 entries', () => {
    const sha512 = 'A'.repeat(87) + '=';
    const result = run(`sha-256=:${SHA256}:, sha-512=:${sha512}:`);
    expect(result.stats).toMatchObject({ entries: 2, invalid: 0, review: 0 });
    expect(rows(result)[0]?.[2]).toBe('Valid');
  });

  it('flags invalid algorithms, lengths, and duplicate entries', () => {
    const result = run(`md5=:${SHA256}:\nsha-256=:bad:\nsha-256=:${SHA256}:`);
    expect(result.stats?.review).toBeGreaterThan(0);
    expect(rows(result)[0]?.[3]).toContain('Unsupported');
    expect(rows(result).some((row) => row[3]?.includes('Duplicate'))).toBe(true);
  });

  it('rejects invalid generated digests', () => {
    expect(() => run('', { mode: 'build', digest: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', digest: 'not base64' })).toThrow(ToolError);
  });

  it('handles malformed structured-field entries', () => {
    const result = run('sha-256=broken');
    expect(result.stats?.invalid).toBe(1);
    expect(rows(result)[0]?.[2]).toBe('Invalid');
  });

  it('returns guidance for blank analysis input', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
