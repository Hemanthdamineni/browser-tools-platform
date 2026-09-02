import { describe, it, expect } from 'vitest';
import tool from './reverse-text.tool';

const r = (text: string, by = 'characters') =>
  (tool.run({ text, options: { by } }) as { output: string }).output;

describe('reverse-text', () => {
  it('reverses characters', () => {
    expect(r('abcde')).toBe('edcba');
  });
  it('keeps a simple emoji intact', () => {
    expect(r('ab👋cd')).toBe('dc👋ba');
  });
  it('reverses word order, keeping spacing', () => {
    expect(r('the quick brown fox', 'words')).toBe('fox brown quick the');
  });
  it('reverses line order', () => {
    expect(r('one\ntwo\nthree', 'lines')).toBe('three\ntwo\none');
  });
  it('reverses words within each line', () => {
    expect(r('a b c\nd e f', 'words-in-line')).toBe('c b a\nf e d');
  });
  it('empty input', () => {
    expect(r('')).toBe('');
  });
  it('is its own inverse for characters', () => {
    const s = 'Hello, World! 123';
    expect(r(r(s))).toBe(s);
  });
});
