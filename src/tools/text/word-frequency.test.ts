import { describe, it, expect } from 'vitest';
import tool from './word-frequency.tool';

type Row = [string, string, string];

async function rows(text: string, options: Record<string, string | number | boolean> = {}): Promise<Row[]> {
  const res = await tool.run({ text, options }) as { output: string; render?: string };
  if (res.output === '') return [];
  expect(res.render).toBe('table');
  const parsed = JSON.parse(res.output) as { headers: string[]; rows: Row[] };
  expect(parsed.headers).toEqual(['Word', 'Count', '%']);
  return parsed.rows;
}

describe('word-frequency', async () => {
  it('counts words case-insensitively by default, sorted by count then word', async () => {
    expect(await rows('the cat the dog the CAT')).toEqual([
      ['the', '3', '50.0%'],
      ['cat', '2', '33.3%'],
      ['dog', '1', '16.7%'],
    ]);
  });

  it('respects case when caseInsensitive is off', async () => {
    const r = await rows('Go go GO go', { caseInsensitive: false });
    expect(r).toHaveLength(3);
    expect(r[0]).toEqual(['go', '2', '50.0%']);
  });

  it('folds case when caseInsensitive is on', async () => {
    expect(await rows('Go go GO go', { caseInsensitive: true })).toEqual([['go', '4', '100.0%']]);
  });

  it('drops words shorter than minLength', async () => {
    expect(await rows('a bb ccc', { minLength: 2 })).toEqual([
      ['bb', '1', '50.0%'],
      ['ccc', '1', '50.0%'],
    ]);
  });

  it('limits to the top N, or all when top is 0', async () => {
    expect((await rows('a b c d', { top: 2 }))).toHaveLength(2);
    expect((await rows('a b c d', { top: 0 }))).toHaveLength(4);
  });

  it('removes stop words when ignoreCommon is set', async () => {
    const r = await rows('the quick brown fox jumps over the lazy dog', { ignoreCommon: true });
    expect(r).toHaveLength(7);
    expect(r.map((row) => row[0])).not.toContain('the');
    expect(r[0]![0]).toBe('brown');
  });

  it('combines minLength and top', async () => {
    expect(
      await rows('one two three four five three four four five five five', { minLength: 4, top: 5 }),
    ).toEqual([
      ['five', '4', '44.4%'],
      ['four', '3', '33.3%'],
      ['three', '2', '22.2%'],
    ]);
  });

  it('returns empty output for empty input', async () => {
    const res = await tool.run({ text: '', options: {} }) as { output: string };
    expect(res.output).toBe('');
  });

  it('reports totals in stats', async () => {
    const res = await tool.run({ text: 'the cat the dog', options: {} }) as {
      stats?: Record<string, string | number>;
    };
    expect(res.stats?.['total words']).toBe(4);
    expect(res.stats?.['unique words']).toBe(3);
  });
});