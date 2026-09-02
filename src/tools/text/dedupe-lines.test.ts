import { describe, it, expect } from 'vitest';
import tool from './dedupe-lines.tool';

const d = (text: string, options: Record<string, string | number | boolean> = {}) =>
  (tool.run({ text, options }) as { output: string }).output.split('\n');

describe('dedupe-lines', () => {
  it('keeps first occurrence, order preserved', () => {
    expect(d('a\nb\na\nc\nb')).toEqual(['a', 'b', 'c']);
  });
  it('keeps last occurrence', () => {
    expect(d('a\nb\na\nc\nb', { keep: 'last' })).toEqual(['a', 'c', 'b']);
  });
  it('only lines that repeat', () => {
    expect(d('a\nb\na\nc\nb', { keep: 'only-duplicates' })).toEqual(['a', 'b']);
  });
  it('only lines that appear once', () => {
    expect(d('a\nb\na\nc\nb', { keep: 'only-unique' })).toEqual(['c']);
  });
  it('ignore case + trim', () => {
    expect(d('Foo\n foo \nbar', { ignoreCase: true, trim: true })).toEqual(['Foo', 'bar']);
  });
  it('can preserve every blank line', () => {
    // both blank lines kept; the trailing duplicate "a" is still removed
    expect(d('a\n\nb\n\na', { keepBlank: true })).toEqual(['a', '', 'b', '']);
  });
  it('empty input', () => {
    expect((tool.run({ text: '', options: {} }) as { output: string }).output).toBe('');
  });
});
