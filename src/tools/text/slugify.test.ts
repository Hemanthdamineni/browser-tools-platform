import { describe, it, expect } from 'vitest';
import tool from './slugify.tool';

const s = (text: string, options: Record<string, string | number | boolean> = {}) =>
  (tool.run({ text, options }) as { output: string }).output;

describe('slugify', () => {
  it('basic title', () => {
    expect(s('My Great Post: Part 2!')).toBe('my-great-post-part-2');
  });
  it('folds accents', () => {
    expect(s('Crème brûlée')).toBe('creme-brulee');
  });
  it('expands common symbols', () => {
    expect(s('Rock & Roll @ 50%')).toBe('rock-and-roll-at-50-percent');
  });
  it('custom separator', () => {
    expect(s('Hello World', { separator: '_' })).toBe('hello_world');
    expect(s('Hello World', { separator: '' })).toBe('helloworld');
  });
  it('keeps case when lowercase is off', () => {
    expect(s('Hello World', { lowercase: false })).toBe('Hello-World');
  });
  it('non-strict keeps other scripts', () => {
    expect(s('Привет мир', { strict: false })).toBe('привет-мир');
    expect(s('Привет мир', { strict: true })).toBe('');
  });
  it('respects max length without leaving a trailing separator', () => {
    const out = s('one two three four five', { maxLength: 12 });
    expect(out.length).toBeLessThanOrEqual(12);
    expect(out.endsWith('-')).toBe(false);
  });
  it('empty input', () => {
    expect(s('')).toBe('');
  });
});
