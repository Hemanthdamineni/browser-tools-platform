import { describe, it, expect } from 'vitest';
import tool from './unit-convert.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) => {
  const r = tool.run({ text, options }) as { output: string };
  return JSON.parse(r.output) as { headers: string[]; rows: string[][] };
};

const cell = (rows: string[][], label: string): string | undefined =>
  rows.find((r) => r[0] === label)?.[1];

describe('unit-convert', () => {
  it('converts 1 km to miles', () => {
    const r = run('1', { category: 'length', from: 'km', to: 'mi' });
    expect(Number(cell(r.rows, 'mile'))).toBeCloseTo(0.621371, 5);
    expect(r.rows[0]).toEqual(['mile', cell(r.rows, 'mile')]);
  });

  it('shows the value in every unit of the category', () => {
    const r = run('1', { category: 'length', from: 'km', to: 'mi' });
    expect(r.headers).toEqual(['Unit', 'Value']);
    expect(r.rows.some((row) => row[0] === 'metre')).toBe(true);
  });

  it('converts temperature via Kelvin', () => {
    const r = run('100', { category: 'temperature', from: 'C', to: 'F' });
    expect(cell(r.rows, 'F')).toBe('212');
    expect(cell(r.rows, 'K')).toBe('373.15');
  });

  it('converts 1 GiB to 1024 MiB', () => {
    const r = run('1', { category: 'data-storage', from: 'GiB', to: 'MiB' });
    expect(cell(r.rows, 'mebibyte')).toBe('1024');
  });

  it('is case-insensitive on unit aliases', () => {
    const r = run('1', { category: 'length', from: 'KM', to: 'MI' });
    expect(Number(cell(r.rows, 'mile'))).toBeCloseTo(0.621371, 5);
  });

  it('throws for an unknown unit', () => {
    expect(() => run('1', { category: 'length', from: 'km', to: 'parsecs' })).toThrow(
      /Unknown unit/,
    );
  });

  it('throws for a non-numeric value', () => {
    expect(() => run('abc', { category: 'length', from: 'km', to: 'mi' })).toThrow(/numeric/);
  });

  it('returns empty output for empty input', () => {
    expect(tool.run({ text: '', options: {} })).toEqual({ output: '' });
  });
});
