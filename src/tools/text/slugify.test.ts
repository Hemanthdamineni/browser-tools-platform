import { describe, it, expect } from 'vitest';
import tool from './slugify.tool';

const s = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  ((await tool.run({ text, options })) as { output: string }).output;

describe('slugify', async () => {
  it('basic title', async () => {
    expect(await s('My Great Post: Part 2!')).toBe('my-great-post-part-2');
  });
  it('folds accents', async () => {
    expect(await s('Crème brûlée')).toBe('creme-brulee');
  });
  it('expands common symbols', async () => {
    expect(await s('Rock & Roll @ 50%')).toBe('rock-and-roll-at-50-percent');
  });
  it('custom separator', async () => {
    expect(await s('Hello World', { separator: '_' })).toBe('hello_world');
    expect(await s('Hello World', { separator: '' })).toBe('helloworld');
  });
  it('keeps case when lowercase is off', async () => {
    expect(await s('Hello World', { lowercase: false })).toBe('Hello-World');
  });
  it('non-strict keeps other scripts', async () => {
    expect(await s('Привет мир', { strict: false })).toBe('привет-мир');
    expect(await s('Привет мир', { strict: true })).toBe('');
  });
  it('respects max length without leaving a trailing separator', async () => {
    const out = await s('one two three four five', { maxLength: 12 });
    expect(out.length).toBeLessThanOrEqual(12);
    expect(out.endsWith('-')).toBe(false);
  });
  it('empty input', async () => {
    expect(await s('')).toBe('');
  });
});
