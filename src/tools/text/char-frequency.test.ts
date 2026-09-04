import { describe, it, expect } from 'vitest';
import tool from './char-frequency.tool';

type Row = [string, string, string];

function rows(text: string, options: Record<string, string | number | boolean> = {}): Row[] {
  const res = tool.run({ text, options }) as { output: string; render?: string };
  if (res.output === '') return [];
  expect(res.render).toBe('table');
  const parsed = JSON.parse(res.output) as { headers: string[]; rows: Row[] };
  expect(parsed.headers).toEqual(['Character', 'Count', '%']);
  return parsed.rows;
}

describe('char-frequency', () => {
  it('counts every character, sorted by count then character', () => {
    expect(rows('aAbb ')).toEqual([
      ['b', '2', '40.0%'],
      ['(space)', '1', '20.0%'],
      ['A', '1', '20.0%'],
      ['a', '1', '20.0%'],
    ]);
  });

  it('folds case when caseInsensitive is set', () => {
    expect(rows('aAbb ', { caseInsensitive: true })).toEqual([
      ['a', '2', '40.0%'],
      ['b', '2', '40.0%'],
      ['(space)', '1', '20.0%'],
    ]);
  });

  it('restricts to letters', () => {
    const r = rows('Hello, World!', { scope: 'letters' });
    expect(r).toHaveLength(7);
    expect(r[0]).toEqual(['l', '3', '30.0%']);
    expect(r[1]).toEqual(['o', '2', '20.0%']);
  });

  it('restricts to letters and digits', () => {
    const r = rows('ab 12!', { scope: 'alphanumeric' });
    expect(r.map((row) => row[0])).toEqual(['1', '2', 'a', 'b']);
  });

  it('excludes whitespace', () => {
    const r = rows('a b\tc\n', { scope: 'no-whitespace' });
    expect(r.map((row) => row[0])).toEqual(['a', 'b', 'c']);
  });

  it('sorts by character when asked', () => {
    expect(rows('banana', { sortBy: 'char' })).toEqual([
      ['a', '3', '50.0%'],
      ['b', '1', '16.7%'],
      ['n', '2', '33.3%'],
    ]);
  });

  it('labels tabs and newlines', () => {
    expect(rows('a\tb\n')).toEqual([
      ['\\t', '1', '25.0%'],
      ['\\n', '1', '25.0%'],
      ['a', '1', '25.0%'],
      ['b', '1', '25.0%'],
    ]);
  });

  it('labels other control characters as \\xNN', () => {
    const input = 'a' + String.fromCharCode(0) + String.fromCharCode(0x1b);
    expect(rows(input).map((row) => row[0])).toEqual(['\\x00', '\\x1B', 'a']);
  });

  it('returns empty output for empty input', () => {
    const res = tool.run({ text: '', options: {} }) as { output: string };
    expect(res.output).toBe('');
  });

  it('reports totals in stats', () => {
    const res = tool.run({ text: 'aabbc', options: {} }) as {
      stats?: Record<string, string | number>;
    };
    expect(res.stats?.total).toBe(5);
    expect(res.stats?.distinct).toBe(3);
  });
});
