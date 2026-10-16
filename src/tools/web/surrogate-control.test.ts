import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './surrogate-control.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('surrogate-control', () => {
  it('builds intermediary directives', () => {
    const result = run('', { mode: 'build', directives: 'max-age=3600, content="ESI/1.0"' });
    expect(result.output).toBe('max-age=3600, content="ESI/1.0"');
    expect(result.filename).toBe('surrogate-control.txt');
  });

  it('analyzes valid directives and quoted content', () => {
    const result = run('max-age=3600, content="ESI/1.0"');
    expect(result.stats).toMatchObject({ directives: 2, issues: 0 });
    expect(rows(result)[1]?.[0]).toBe('content');
  });

  it('flags duplicates and storage conflicts', () => {
    const result = run('no-store, max-age=60, max-age=120');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('conflicts');
  });

  it('rejects invalid generated directives', () => {
    expect(() => run('', { mode: 'build', directives: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', directives: 'max-age=soon' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', directives: 'content=ESI' })).toThrow(ToolError);
  });

  it('handles malformed input and blank analysis', () => {
    expect(rows(run('max-age=bad'))[0]?.[2]).toBe('Review');
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('accepts no-store without a value', () => {
    expect(run('no-store').stats?.issues).toBe(0);
  });
});
