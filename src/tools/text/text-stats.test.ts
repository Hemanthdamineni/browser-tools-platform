import { describe, it, expect } from 'vitest';
import tool from './text-stats.tool';

type Row = [string, string];

async function rows(text: string): Promise<Row[]> {
  const res = await tool.run({ text, options: {} }) as { output: string; render?: string };
  expect(res.render).toBe('table');
  const parsed = JSON.parse(res.output) as { headers: string[]; rows: Row[] };
  expect(parsed.headers).toEqual(['Metric', 'Value']);
  return parsed.rows;
}

async function value(text: string, metric: string): Promise<string> {
  const found = (await rows(text)).find((r) => r[0] === metric);
  if (!found) throw new Error(`missing metric ${metric}`);
  return found[1];
}

describe('text-stats', async () => {
  const sample = 'The quick brown fox. The lazy dog runs.';

  it('counts characters with and without whitespace', async () => {
    expect(await value(sample, 'Characters')).toBe('39');
    expect(await value(sample, 'Characters (no spaces)')).toBe('32');
  });

  it('counts words, unique words, sentences, paragraphs and lines', async () => {
    expect(await value(sample, 'Words')).toBe('8');
    expect(await value(sample, 'Unique words')).toBe('7');
    expect(await value(sample, 'Sentences')).toBe('2');
    expect(await value(sample, 'Paragraphs')).toBe('1');
    expect(await value(sample, 'Lines')).toBe('1');
  });

  it('derives averages, longest word and durations', async () => {
    expect(await value(sample, 'Average word length')).toBe('4');
    expect(await value(sample, 'Longest word')).toBe('quick');
    expect(await value(sample, 'Average sentence length (words)')).toBe('4');
    expect(await value(sample, 'Reading time')).toBe('2s');
    expect(await value(sample, 'Speaking time')).toBe('4s');
  });

  it('formats long reading times as minutes and seconds', async () => {
    const long = Array.from({ length: 600 }, () => 'word').join(' ');
    expect(await value(long, 'Reading time')).toBe('2m 31s');
  });

  it('counts blank-line separated paragraphs', async () => {
    const text = 'First paragraph, line one.\n\nSecond paragraph here.';
    expect(await value(text, 'Paragraphs')).toBe('2');
    expect(await value(text, 'Lines')).toBe('3');
  });

  it('returns a table of zeros for empty input', async () => {
    const r = await rows('');
    expect(r).toHaveLength(12);
    expect(r.every((row) => row[1] === '0')).toBe(true);
  });
});