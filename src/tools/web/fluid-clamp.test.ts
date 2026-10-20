import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './fluid-clamp.tool';

type Result = { output: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text: '', options }) as Result;

describe('fluid-clamp', () => {
  it('generates a clamp expression with the expected property and bounds', () => {
    const result = run({
      minValue: 16,
      maxValue: 32,
      minViewport: 400,
      maxViewport: 1200,
      unit: 'px',
      property: 'font-size',
      precision: 3,
    });
    expect(result.output).toBe('font-size: clamp(16px, 8px + 2vw, 32px);');
    expect(result.stats?.['minimum value']).toBe('16px');
    expect(result.stats?.['maximum value']).toBe('32px');
  });

  it('converts rem bounds and slope using the configured root size', () => {
    const result = run({
      minValue: 16,
      maxValue: 32,
      minViewport: 400,
      maxViewport: 1200,
      unit: 'rem',
      rootFontSize: 16,
      property: '',
      precision: 4,
    });
    expect(result.output).toBe('clamp(1rem, 0.5rem + 2vw, 2rem)');
  });

  it('supports decreasing values and negative slope', () => {
    const result = run({
      minValue: 40,
      maxValue: 20,
      minViewport: 400,
      maxViewport: 1200,
      unit: 'px',
      property: 'letter-spacing',
      precision: 3,
    });
    expect(result.output).toBe('letter-spacing: clamp(20px, 50px - 2.5vw, 40px);');
    expect(result.notes?.some((note) => note.includes('decreases'))).toBe(true);
  });

  it('evaluates to both requested endpoints at their viewport widths', () => {
    const result = run({
      minValue: 16,
      maxValue: 32,
      minViewport: 400,
      maxViewport: 1200,
      unit: 'px',
      property: '',
      precision: 6,
    });
    const match = /clamp\(([-\d.]+)px, ([-\d.]+)px ([+-]) ([\d.]+)vw, ([-\d.]+)px\)/.exec(
      result.output,
    );
    expect(match).not.toBeNull();
    const [, low, intercept, operator, slope, high] = match!;
    const at = (viewport: number) =>
      Math.max(
        Number(low),
        Math.min(
          Number(high),
          Number(intercept) + ((operator === '-' ? -1 : 1) * Number(slope) * viewport) / 100,
        ),
      );
    expect(at(400)).toBeCloseTo(16, 5);
    expect(at(1200)).toBeCloseTo(32, 5);
  });

  it('supports custom properties and CSS units', () => {
    expect(run({ unit: 'em', property: '--fluid-gap' }).output).toContain('--fluid-gap: clamp(');
    expect(run({ unit: 'vw', property: '' }).output).toContain('vw');
  });

  it('rejects invalid viewport ranges, precision, and property injection', () => {
    expect(() => run({ minViewport: 500, maxViewport: 500 })).toThrow(ToolError);
    expect(() => run({ minViewport: 0 })).toThrow(ToolError);
    expect(() => run({ precision: 7 })).toThrow(ToolError);
    expect(() => run({ property: 'color; background:red' })).toThrow(ToolError);
  });

  it('rejects non-finite values and non-positive root size', () => {
    expect(() => run({ minValue: Number.NaN })).toThrow(ToolError);
    expect(() => run({ rootFontSize: 0 })).toThrow(ToolError);
  });
});
