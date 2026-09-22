import { describe, it, expect } from 'vitest';
import tool from './reverse-text.tool';

const r = async (text: string, by = 'characters') =>
  ((await tool.run({ text, options: { by } })) as { output: string }).output;

describe('reverse-text', async () => {
  it('reverses characters', async () => {
    expect(await r('abcde')).toBe('edcba');
  });
  it('keeps a simple emoji intact', async () => {
    expect(await r('ab👋cd')).toBe('dc👋ba');
  });
  it('reverses word order, keeping spacing', async () => {
    expect(await r('the quick brown fox', 'words')).toBe('fox brown quick the');
  });
  it('reverses line order', async () => {
    expect(await r('one\ntwo\nthree', 'lines')).toBe('three\ntwo\none');
  });
  it('reverses words within each line', async () => {
    expect(await r('a b c\nd e f', 'words-in-line')).toBe('c b a\nf e d');
  });
  it('empty input', async () => {
    expect(await r('')).toBe('');
  });
  it('is its own inverse for characters', async () => {
    const s = 'Hello, World! 123';
    expect(await r(await r(s))).toBe(s);
  });
});
