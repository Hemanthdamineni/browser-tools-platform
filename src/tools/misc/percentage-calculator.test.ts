import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './percentage-calculator.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;

describe('percentage-calculator', () => {
  it('computes a percentage of a number', () => {
    const result = run('20 150');
    expect(result.stats?.result).toBe(30);
  });

  it('handles percentages over 100', () => {
    const result = run('150 40');
    expect(result.stats?.result).toBe(60);
  });

  it('computes percentage change including increase over 100', () => {
    const result = run('50 200', { mode: 'percent-change' });
    expect(result.stats?.percentChange).toBe(300);
    expect(run('80 100', { mode: 'percent-change' }).stats?.percentChange).toBe(25);
    expect(run('100 80', { mode: 'percent-change' }).stats?.percentChange).toBe(-20);
  });

  it('applies increase and decrease', () => {
    expect(run('50 15', { mode: 'increase' }).stats?.result).toBe(57.5);
    expect(run('50 20', { mode: 'decrease' }).stats?.result).toBe(40);
  });

  it('rejects change from zero and bad arity', () => {
    expect(() => run('0 10', { mode: 'percent-change' })).toThrow(ToolError);
    expect(() => run('10', { mode: 'percent-of' })).toThrow(ToolError);
  });

  it('handles blank input', () => {
    expect(run('').notes?.[0]).toContain('20 150');
  });
});
