import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './signature-input.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('signature-input', () => {
  it('builds covered components and parameters', () => {
    const result = run('', { mode: 'build', label: 'sig1', components: '@method @target-uri content-digest', keyid: 'service-key-1', created: 1710000000 });
    expect(result.output).toBe('sig1=("@method" "@target-uri" "content-digest");created=1710000000;keyid="service-key-1"');
    expect(result.filename).toBe('signature-input.txt');
  });

  it('analyzes valid signature input', () => {
    const result = run('sig1=("@method" "@target-uri" "content-digest");created=1710000000;keyid="service-key-1"');
    expect(result.stats).toMatchObject({ signatures: 1, invalid: 0, review: 0 });
    expect(rows(result)[0]?.[2]).toBe('created');
  });

  it('flags missing keyid and invalid timestamps', () => {
    const result = run('sig1=("@method");created=now');
    expect(result.stats?.review).toBeGreaterThan(0);
    expect(rows(result)[0]?.[4]).toBe('Review');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', label: '', components: '@method', keyid: 'key', created: 1 })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', label: 'sig1', components: '', keyid: 'key', created: 1 })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', label: 'sig1', components: '@method', keyid: 'key', created: -1 })).toThrow(ToolError);
  });

  it('handles malformed input and blank analysis', () => {
    expect(rows(run('not signature input'))[0]?.[4]).toBe('Invalid signature-input syntax');
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('accepts optional expires and tag parameters', () => {
    const result = run('sig1=("@method");created=1710000000;expires=1710003600;keyid="key";tag="api"');
    expect(result.stats?.review).toBe(0);
  });
});
