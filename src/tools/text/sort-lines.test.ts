import { describe, it, expect } from 'vitest';
import tool from './sort-lines.tool';

const s = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options }) as { output: string }).output.split('\n');

describe('sort-lines', async () => {
  it('alphabetical ascending / descending', async () => {
    expect(await s('banana\napple\ncherry')).toEqual(['apple', 'banana', 'cherry']);
    expect(await s('banana\napple\ncherry', { direction: 'desc' })).toEqual([
      'cherry',
      'banana',
      'apple',
    ]);
  });
  it('natural sort', async () => {
    expect(await s('file10\nfile2\nfile1', { method: 'natural' })).toEqual(['file1', 'file2', 'file10']);
  });
  it('numeric by leading number', async () => {
    expect(await s('30 c\n9 b\n100 a', { method: 'numeric' })).toEqual(['9 b', '30 c', '100 a']);
  });
  it('by length', async () => {
    expect(await s('ccc\na\nbb', { method: 'length' })).toEqual(['a', 'bb', 'ccc']);
  });
  it('unique + removeBlank', async () => {
    expect(await s('a\n\nb\na\n', { unique: true, removeBlank: true })).toEqual(['a', 'b']);
  });
  it('case-insensitive by default', async () => {
    expect(await s('Banana\napple')).toEqual(['apple', 'Banana']);
  });
  it('shuffle is deterministic for the same input and keeps all lines', async () => {
    const a = await s('1\n2\n3\n4\n5\n6\n7\n8', { method: 'shuffle' });
    const b = await s('1\n2\n3\n4\n5\n6\n7\n8', { method: 'shuffle' });
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });
  it('empty input', async () => {
    expect(await tool.run({ text: '', options: {} })).toMatchObject({ output: '' });
  });
});