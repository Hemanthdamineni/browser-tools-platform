import { describe, expect, it } from 'vitest';
import tool from './roman-numeral.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string };

describe('roman-numeral', () => {
  it('converts known decimal values to Roman numerals', () => {
    expect(run('1')).toMatchObject({ output: 'I' });
    expect(run('2024')).toMatchObject({ output: 'MMXXIV' });
    expect(run('3999')).toMatchObject({ output: 'MMMCMXCIX' });
  });

  it('converts a Roman numeral to a decimal value', () => {
    expect(run('MMXXIV', { mode: 'to-number' })).toMatchObject({ output: '2024' });
  });

  it('auto-detects Roman numeral input', () => {
    expect(run('MMXXIV', { mode: 'auto' })).toMatchObject({ output: '2024' });
    expect(run('2024', { mode: 'auto' })).toMatchObject({ output: 'MMXXIV' });
  });

  it('supports extended parenthesised thousands notation', () => {
    expect(run('4000', { extended: true })).toMatchObject({ output: '(IV)' });
    expect(run('(IV)', { mode: 'to-number', extended: true })).toMatchObject({ output: '4000' });
  });

  it('rejects values above the standard range without extended mode', () => {
    expect(() => run('4000')).toThrow(/between 1 and 3999/);
  });

  it('rejects invalid decimal input', () => {
    expect(() => run('1.5')).toThrow(/positive whole number/);
    expect(() => run('0')).toThrow(/positive whole number/);
    expect(() => run('-1')).toThrow(/positive whole number/);
  });

  it('rejects invalid Roman numeral input', () => {
    expect(() => run('IIII', { mode: 'to-number' })).toThrow(/not a valid Roman numeral/);
    expect(() => run('(IV)', { mode: 'to-number' })).toThrow(/not a valid Roman numeral/);
    expect(() => run('(IV)(V)', { mode: 'to-number', extended: true })).toThrow(
      /Only one parenthesised thousands group/,
    );
  });

  it('returns empty output for empty input', () => {
    expect(tool.run({ text: '', options: {} })).toEqual({ output: '' });
  });
});
