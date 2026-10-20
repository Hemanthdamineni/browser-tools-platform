import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './critical-ch.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('critical-ch', () => {
  it('builds a normalized critical-hints header', () => {
    const result = run('', { mode: 'build', hints: 'Viewport-Width DPR' });
    expect(result.output).toBe('Viewport-Width, DPR');
    expect(result.filename).toBe('critical-ch.txt');
  });

  it('analyzes valid critical hints', () => {
    const result = run('Viewport-Width, DPR');
    expect(result.stats).toMatchObject({ hints: 2, issues: 0, highEntropy: 0 });
    expect(rows(result)[0]?.[1]).toBe('Valid');
  });

  it('flags duplicates and high-entropy hints', () => {
    const result = run('Device-Memory, device-memory, Sec-CH-UA-Model');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.stats?.highEntropy).toBe(2);
    expect(result.notes?.join(' ')).toContain('fingerprinting');
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', hints: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', hints: 'Viewport_Width' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', hints: 'Device-Memory' })).toThrow(ToolError);
  });

  it('handles malformed input and blank analysis', () => {
    expect(rows(run('bad_hint!'))[0]?.[1]).toBe('Review');
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('accepts comma and whitespace separators', () => {
    expect(run('', { mode: 'build', hints: 'Viewport-Width, DPR' }).output).toBe(
      'Viewport-Width, DPR',
    );
  });
});
