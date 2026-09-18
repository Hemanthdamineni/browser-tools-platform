import { describe, it, expect } from 'vitest';
import tool from './dedupe-lines.tool';

const d = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options }) as { output: string }).output.split('\n');

describe('dedupe-lines', async () => {
  it('keeps first occurrence, order preserved', async () => {
    expect(await d('a\nb\na\nc\nb')).toEqual(['a', 'b', 'c']);
  });
  it('keeps last occurrence', async () => {
    expect(await d('a\nb\na\nc\nb', { keep: 'last' })).toEqual(['a', 'c', 'b']);
  });
  it('only lines that repeat', async () => {
    expect(await d('a\nb\na\nc\nb', { keep: 'only-duplicates' })).toEqual(['a', 'b']);
  });
  it('only lines that appear once', async () => {
    expect(await d('a\nb\na\nc\nb', { keep: 'only-unique' })).toEqual(['c']);
  });
  it('ignore case + trim', async () => {
    expect(await d('Foo\n foo \nbar', { ignoreCase: true, trim: true })).toEqual(['Foo', 'bar']);
  });
  it('can preserve every blank line', async () => {
    // both blank lines kept; the trailing duplicate "a" is still removed
    expect(await d('a\n\nb\n\na', { keepBlank: true })).toEqual(['a', '', 'b', '']);
  });
  it('empty input', async () => {
    expect((await tool.run({ text: '', options: {} }) as { output: string }).output).toBe('');
  });
});