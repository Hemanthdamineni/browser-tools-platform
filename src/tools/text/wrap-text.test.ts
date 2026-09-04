import { describe, it, expect } from 'vitest';
import tool from './wrap-text.tool';

type Opts = Record<string, string | number | boolean>;
const run = (text: string, options: Opts = {}) =>
  tool.run({ text, options }) as {
    output: string;
    stats?: Record<string, string | number>;
  };

describe('wrap-text', () => {
  it('greedily wraps to the given width', () => {
    expect(run('the quick brown fox jumps', { mode: 'wrap', width: 10 }).output).toBe(
      'the quick\nbrown fox\njumps',
    );
  });

  it('preserves blank lines between paragraphs by default', () => {
    expect(run('aaa bbb\n\nccc ddd', { mode: 'wrap', width: 5 }).output).toBe(
      'aaa\nbbb\n\nccc\nddd',
    );
  });

  it('merges paragraphs when preserveParagraphs is off', () => {
    expect(run('aaa\n\nbbb', { mode: 'wrap', width: 80, preserveParagraphs: false }).output).toBe(
      'aaa bbb',
    );
  });

  it('breaks over-long words when breakLongWords is on', () => {
    expect(run('abcdefghij km', { mode: 'wrap', width: 4, breakLongWords: true }).output).toBe(
      'abcd\nefgh\nij\nkm',
    );
  });

  it('leaves over-long words intact when breakLongWords is off', () => {
    expect(run('abcdefghij km', { mode: 'wrap', width: 4 }).output).toBe('abcdefghij\nkm');
  });

  it('unwraps lines within a paragraph, keeping paragraph breaks', () => {
    expect(run('line one\nline two\n\npara two here', { mode: 'unwrap' }).output).toBe(
      'line one line two\n\npara two here',
    );
  });

  it('unwraps everything to one line when preserveParagraphs is off', () => {
    expect(run('a\nb\n\nc', { mode: 'unwrap', preserveParagraphs: false }).output).toBe('a b c');
  });

  it('empty input → empty output', () => {
    expect(run('').output).toBe('');
  });

  it('throws ToolError on a non-positive width', () => {
    expect(() => run('hello there', { mode: 'wrap', width: 0 })).toThrow(/width/i);
  });

  it('reports line count in stats', () => {
    expect(run('the quick brown fox jumps', { mode: 'wrap', width: 10 }).stats?.lines).toBe(3);
  });
});
