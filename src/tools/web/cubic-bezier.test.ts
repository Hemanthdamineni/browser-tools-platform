import { describe, it, expect } from 'vitest';
import tool from './cubic-bezier.tool';
import { ToolError } from '@/lib/types';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options });
const rows = (r: ReturnType<typeof run>) => (JSON.parse(r.output) as { rows: string[][] }).rows;

describe('cubic-bezier', () => {
  it('0.25,0.1,0.25,1 is nearest to the "ease" keyword', () => {
    const r = run('0.25, 0.1, 0.25, 1');
    expect(r.stats!['nearest keyword']).toBe('ease');
  });

  it('samples 11 evenly spaced t values by default', () => {
    const r = run('0.25, 0.1, 0.25, 1');
    expect(rows(r)).toHaveLength(11);
    expect(rows(r)[0]).toEqual(['0', '0']);
    expect(rows(r)[10]).toEqual(['1', '1']);
  });

  it('linear produces progress ≈ t', () => {
    const r = run('0, 0, 1, 1');
    expect(r.stats!['nearest keyword']).toBe('linear');
    for (const [t, p] of rows(r)) {
      expect(Math.abs(Number(p) - Number(t))).toBeLessThan(0.001);
    }
  });

  it('exposes the canonical cubic-bezier() string', () => {
    expect(run('0.42, 0, 1, 1').stats!['cubic-bezier()']).toBe('cubic-bezier(0.42, 0, 1, 1)');
    expect(run('0.42, 0, 1, 1').stats!['nearest keyword']).toBe('ease-in');
  });

  it('ease-out and ease-in-out are recognised', () => {
    expect(run('0, 0, 0.58, 1').stats!['nearest keyword']).toBe('ease-out');
    expect(run('0.42, 0, 0.58, 1').stats!['nearest keyword']).toBe('ease-in-out');
  });

  it('honours the samples option', () => {
    expect(rows(run('0,0,1,1', { samples: 5 }))).toHaveLength(5);
  });

  it('throws ToolError when x values leave [0,1]', () => {
    expect(() => run('-0.1, 0, 0.5, 1')).toThrow(ToolError);
    expect(() => run('0.5, 0, 1.5, 1')).toThrow(/between 0 and 1/);
  });

  it('throws ToolError when not four numbers', () => {
    expect(() => run('1, 2, 3')).toThrow(ToolError);
    expect(() => run('a, b, c, d')).toThrow(/four numbers/);
  });

  it('empty input gives empty output', () => {
    expect(run('').output).toBe('');
  });
});
