import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './speculation-rules.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;

describe('speculation-rules', () => {
  it('builds a prefetch rules JSON', () => {
    const result = run('', { mode: 'build', type: 'prefetch', eagerness: 'moderate', urls: '/next, /about' });
    const json = JSON.parse(result.output);
    expect(json).toHaveProperty('prefetch');
    expect(result.filename).toBe('speculation-rules.json');
    expect(result.stats?.prefetch).toBe(2);
  });

  it('analyzes valid prefetch and prerender rules', () => {
    const input = '{"prefetch":[{"source":"list","urls":["/next","/about"]}],"prerender":[{"source":"list","urls":["/"]}]}';
    const result = run(input);
    expect(result.stats?.prefetch).toBe(1);
    expect(result.stats?.prerender).toBe(1);
    expect(result.stats?.issues).toBe(0);
  });

  it('flags invalid eagerness and top-level keys', () => {
    const result = run('{"prefetch":[{"source":"list","eagerness":"ultra-fast"}]}');
    expect(result.notes?.join(' ')).toContain('eagerness');
  });

  it('flags JSON parse errors and empty rules', () => {
    const bad = run('not json');
    expect(bad.notes?.join(' ')).toContain('Invalid JSON');
    const empty = run('{}');
    expect(empty.notes?.join(' ')).toMatch(/prefetch|prerender/);
  });

  it('handles external URL references with guidance', () => {
    const result = run('https://example.com/speculation-rules.json');
    expect(result.stats?.external).toBe(1);
    expect(result.notes?.[0]).toContain('fetch');
  });

  it('rejects invalid build values and handles blank analysis', () => {
    expect(() => run('', { mode: 'build', type: 'bogus', eagerness: 'conservative', urls: '/page' })).toThrow(ToolError);
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
