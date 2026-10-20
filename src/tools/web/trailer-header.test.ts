import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './trailer-header.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('trailer-header', () => {
  it('builds a normalized Trailer declaration', () => {
    const result = run('', { mode: 'build', fields: 'Checksum, Server-Timing' });
    expect(result.output).toBe('checksum, server-timing');
    expect(result.filename).toBe('trailer.txt');
  });

  it('analyzes valid trailer field names', () => {
    const result = run('Checksum, Server-Timing');
    expect(result.stats).toMatchObject({ fields: 2, issues: 0, forbidden: 0 });
    expect(rows(result)[0]?.[1]).toBe('Valid');
  });

  it('flags duplicates, invalid tokens, and forbidden fields', () => {
    const result = run('Digest, Digest, Content-Length, bad field');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.stats?.forbidden).toBe(1);
    expect(result.notes?.join(' ')).toContain('not permitted');
  });

  it('rejects invalid generated declarations', () => {
    expect(() => run('', { mode: 'build', fields: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', fields: 'Content-Length' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', fields: 'bad field' })).toThrow(ToolError);
  });

  it('returns guidance for blank analysis input', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('normalizes mixed-case field names', () => {
    expect(run('', { mode: 'build', fields: 'Digest' }).output).toBe('digest');
  });
});
