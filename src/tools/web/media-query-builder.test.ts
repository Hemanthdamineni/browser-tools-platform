import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './media-query-builder.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;

describe('media-query-builder', () => {
  it('builds a min-width range query', () => {
    const result = run('', { mode: 'build', minWidth: '768px', maxWidth: '1024px' });
    expect(result.output).toBe('@media (min-width: 768px) and (max-width: 1024px)');
    expect(result.filename).toBe('media-query.txt');
  });

  it('builds a query with a feature condition', () => {
    const result = run('', { mode: 'build', minWidth: '480px', features: '(prefers-reduced-motion: reduce)' });
    expect(result.output).toBe('@media (min-width: 480px) and (prefers-reduced-motion: reduce)');
  });

  it('analyzes a valid ranged query', () => {
    const result = run('@media (min-width: 768px) and (max-width: 1024px)');
    expect(result.stats?.issues).toBe(0);
    expect(result.stats?.conditions).toBe(2);
    expect(result.notes?.[0]).toContain('Valid');
  });

  it('flags unbalanced parentheses and unknown features', () => {
    const result = run('@media (min-width: 768px and (hover: hover)');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('Missing');
  });

  it('rejects building with no conditions and an invalid feature', () => {
    expect(() => run('', { mode: 'build', minWidth: '', maxWidth: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', minWidth: '768px', features: 'bogus' })).toThrow(ToolError);
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
