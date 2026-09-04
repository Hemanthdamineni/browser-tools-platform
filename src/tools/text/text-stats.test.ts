import { describe, it, expect } from 'vitest';
import tool from './text-stats.tool';

type Row = [string, string];

function rows(text: string): Row[] {
  const res = tool.run({ text, options: {} }) as { output: string; render?: string };
  expect(res.render).toBe('table');
  const parsed = JSON.parse(res.output) as { headers: string[]; rows: Row[] };
  expect(parsed.headers).toEqual(['Metric', 'Value']);
  return parsed.rows;
}

function value(text: string, metric: string): string {
  const found = rows(text).find((r) => r[0] === metric);
  if (!found) throw new Error(`missing metric ${metric}`);
  return found[1];
}

describe('text-stats', () => {
  const sample = 'The quick brown fox. The lazy dog runs.';

  it('counts characters with and without whitespace', () => {
    expect(value(sample, 'Characters')).toBe('39');
    expect(value(sample, 'Characters (no spaces)')).toBe('32');
  });

  it('counts words, unique words, sentences, paragraphs and lines', () => {
    expect(value(sample, 'Words')).toBe('8');
    expect(value(sample, 'Unique words')).toBe('7');
    expect(value(sample, 'Sentences')).toBe('2');
    expect(value(sample, 'Paragraphs')).toBe('1');
    expect(value(sample, 'Lines')).toBe('1');
  });

  it('derives averages, longest word and durations', () => {
    expect(value(sample, 'Average word length')).toBe('4');
    expect(value(sample, 'Longest word')).toBe('quick');
    expect(value(sample, 'Average sentence length (words)')).toBe('4');
    expect(value(sample, 'Reading time')).toBe('2s');
    expect(value(sample, 'Speaking time')).toBe('4s');
  });

  it('formats long reading times as minutes and seconds', () => {
    const long = Array.from({ length: 600 }, () => 'word').join(' ');
    expect(value(long, 'Reading time')).toBe('2m 31s');
  });

  it('counts blank-line separated paragraphs', () => {
    const text = 'First paragraph, line one.\n\nSecond paragraph here.';
    expect(value(text, 'Paragraphs')).toBe('2');
    expect(value(text, 'Lines')).toBe('3');
  });

  it('returns a table of zeros for empty input', () => {
    const r = rows('');
    expect(r).toHaveLength(12);
    expect(r.every((row) => row[1] === '0')).toBe(true);
  });
});
