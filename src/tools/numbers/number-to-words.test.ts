import { describe, expect, it } from 'vitest';
import tool from './number-to-words.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string };

describe('number-to-words', () => {
  it('spells zero', () => {
    expect(run('0')).toMatchObject({ output: 'zero' });
  });

  it('spells a small number', () => {
    expect(run('7')).toMatchObject({ output: 'seven' });
  });

  it('spells a teen', () => {
    expect(run('15')).toMatchObject({ output: 'fifteen' });
  });

  it('spells a two-digit number with and', () => {
    expect(run('21')).toMatchObject({ output: 'twenty-one' });
  });

  it('spells 1234 with and', () => {
    expect(run('1234')).toMatchObject({ output: 'one thousand two hundred and thirty-four' });
  });

  it('spells 1234 without and', () => {
    expect(run('1234', { useAnd: false })).toMatchObject({
      output: 'one thousand two hundred thirty-four',
    });
  });

  it('spells a negative number', () => {
    expect(run('-5')).toMatchObject({ output: 'negative five' });
  });

  it('spells a decimal digit by digit', () => {
    expect(run('3.14')).toMatchObject({ output: 'three point one four' });
  });

  it('spells a million', () => {
    expect(run('1000000')).toMatchObject({ output: 'one million' });
  });

  it('spells an ordinal', () => {
    expect(run('21', { style: 'ordinal' })).toMatchObject({ output: 'twenty-first' });
  });

  it('spells a large number with BigInt-scale units', () => {
    expect(run('1000000000000')).toMatchObject({ output: 'one trillion' });
  });

  it('applies title case', () => {
    expect(run('1234', { letterCase: 'title' })).toMatchObject({
      output: 'One Thousand Two Hundred and Thirty-Four',
    });
  });

  it('applies upper case', () => {
    expect(run('7', { letterCase: 'upper' })).toMatchObject({ output: 'SEVEN' });
  });

  it('applies sentence case', () => {
    expect(run('1234', { letterCase: 'sentence' })).toMatchObject({
      output: 'One thousand two hundred and thirty-four',
    });
  });

  it('throws for a non-numeric input', () => {
    expect(() => run('abc')).toThrow(/numeric/);
  });

  it('returns empty output for empty input', () => {
    expect(tool.run({ text: '', options: {} })).toEqual({ output: '' });
  });
});
