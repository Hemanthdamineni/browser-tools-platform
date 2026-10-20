import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './cross-origin-embedder-policy.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('cross-origin-embedder-policy', () => {
  it('builds a strict embedding policy', () => {
    const result = run('', { mode: 'build', value: 'require-corp' });
    expect(result.output).toBe('require-corp');
    expect(result.filename).toBe('cross-origin-embedder-policy.txt');
  });

  it('analyzes supported policies', () => {
    expect(run('require-corp').stats).toMatchObject({ valid: 'yes', strict: 'yes' });
    expect(rows(run('credentialless'))[0]?.[2]).toContain('credentialless');
  });

  it('rejects unsupported policy values', () => {
    const result = run('same-origin');
    expect(result.stats?.valid).toBe('no');
    expect(rows(result)[0]?.[2]).toContain('require-corp');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', value: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', value: 'credentialless-all' })).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('accepts credentialless wildcard syntax', () => {
    expect(run('', { mode: 'build', value: 'credentialless=*' }).output).toBe('credentialless=*');
  });
});
