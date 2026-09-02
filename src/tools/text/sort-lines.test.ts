import { describe, it, expect } from 'vitest';
import tool from './sort-lines.tool';

const s = (text: string, options: Record<string, string | number | boolean> = {}) =>
  (tool.run({ text, options }) as { output: string }).output.split('\n');

describe('sort-lines', () => {
  it('alphabetical ascending / descending', () => {
    expect(s('banana\napple\ncherry')).toEqual(['apple', 'banana', 'cherry']);
    expect(s('banana\napple\ncherry', { direction: 'desc' })).toEqual([
      'cherry',
      'banana',
      'apple',
    ]);
  });
  it('natural sort', () => {
    expect(s('file10\nfile2\nfile1', { method: 'natural' })).toEqual(['file1', 'file2', 'file10']);
  });
  it('numeric by leading number', () => {
    expect(s('30 c\n9 b\n100 a', { method: 'numeric' })).toEqual(['9 b', '30 c', '100 a']);
  });
  it('by length', () => {
    expect(s('ccc\na\nbb', { method: 'length' })).toEqual(['a', 'bb', 'ccc']);
  });
  it('unique + removeBlank', () => {
    expect(s('a\n\nb\na\n', { unique: true, removeBlank: true })).toEqual(['a', 'b']);
  });
  it('case-insensitive by default', () => {
    expect(s('Banana\napple')).toEqual(['apple', 'Banana']);
  });
  it('shuffle is deterministic for the same input and keeps all lines', () => {
    const a = s('1\n2\n3\n4\n5\n6\n7\n8', { method: 'shuffle' });
    const b = s('1\n2\n3\n4\n5\n6\n7\n8', { method: 'shuffle' });
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });
  it('empty input', () => {
    expect(tool.run({ text: '', options: {} })).toMatchObject({ output: '' });
  });
});
