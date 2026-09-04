import { describe, it, expect } from 'vitest';
import tool from './css-units.tool';
import { ToolError } from '@/lib/types';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options });
const rows = (r: ReturnType<typeof run>) => (JSON.parse(r.output) as { rows: string[][] }).rows;
const val = (r: ReturnType<typeof run>, unit: string) => rows(r).find((row) => row[0] === unit)![1];

describe('css-units', () => {
  it('24px → 1.5rem with the default 16px root', () => {
    const r = run('24px');
    expect(val(r, 'rem')).toBe('1.5');
  });

  it('1.5rem → 24px with root 16', () => {
    expect(val(run('1.5rem'), 'px')).toBe('24');
  });

  it('12pt → 16px (96 px per inch, 72 pt per inch)', () => {
    expect(val(run('12pt'), 'px')).toBe('16');
  });

  it('absolute units convert: 1in → 96px → 2.54cm', () => {
    expect(val(run('1in'), 'px')).toBe('96');
    expect(Number(val(run('1in'), 'em'))).toBeCloseTo(6, 4);
  });

  it('input without a unit uses the fromUnit option', () => {
    expect(val(run('24', { fromUnit: 'px' }), 'rem')).toBe('1.5');
    expect(val(run('24', { fromUnit: 'pt' }), 'px')).toBe('32');
  });

  it('percent base drives the % row', () => {
    expect(val(run('50%', { percentBase: 200 }), 'px')).toBe('100');
  });

  it('respects a custom root font size', () => {
    expect(val(run('2rem', { rootFontSize: 20 }), 'px')).toBe('40');
  });

  it('rounds to 4 dp and trims trailing zeros', () => {
    expect(val(run('1px'), 'rem')).toBe('0.0625');
  });

  it('throws ToolError on non-numeric input', () => {
    expect(() => run('big')).toThrow(ToolError);
    expect(() => run('big')).toThrow(/number, optionally with a unit/);
  });

  it('empty input gives empty output', () => {
    expect(run('').output).toBe('');
  });
});
