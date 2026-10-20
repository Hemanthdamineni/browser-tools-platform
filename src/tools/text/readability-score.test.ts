import { describe, expect, it } from 'vitest';
import tool from './readability-score.tool';

type Result = {
  output: string;
  render?: string;
  stats?: Record<string, number>;
  notes?: string[];
};
interface Table {
  headers: string[];
  rows: string[][];
}
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const table = (r: Result): Table => JSON.parse(r.output) as Table;

describe('readability-score', () => {
  it('reports both Flesch metrics as a table', async () => {
    const r = await run('The quick brown fox jumps over the lazy dog.');
    const t = table(r);
    expect(t.headers).toEqual(['Metric', 'Value', 'Interpretation']);
    expect(t.rows[0]![0]).toBe('Flesch Reading Ease');
    expect(t.rows[1]![0]).toBe('Flesch-Kincaid Grade Level');
    expect(t.rows[0]![1]).toMatch(/^[\d.]+ \/ 100$/);
    expect(t.rows[1]![1]).toMatch(/^Grade [\d.]+$/);
  });

  it('scores simple prose as easier than dense prose', async () => {
    const simple = await run('The cat sat on the mat. The dog ran fast. We had fun.');
    const dense = await run(
      'Notwithstanding the aforementioned considerations, the extraordinarily complicated methodological framework necessitates comprehensive reevaluation.',
    );
    expect(simple.stats!.ease!).toBeGreaterThan(dense.stats!.ease!);
    expect(dense.stats!.grade!).toBeGreaterThan(simple.stats!.grade!);
  });

  it('keeps scores inside their valid ranges', async () => {
    const r = await run(
      'Supercalifragilisticexpialidocious antidisestablishmentarianism pneumonoultramicroscopicsilicovolcanoconiosis.',
    );
    expect(r.stats!.ease!).toBeGreaterThanOrEqual(0);
    expect(r.stats!.ease!).toBeLessThanOrEqual(100);
    expect(r.stats!.grade!).toBeGreaterThanOrEqual(0);
    expect(r.stats!.grade!).toBeLessThanOrEqual(20);
  });

  it('counts words and sentences and estimates syllables', async () => {
    const r = await run('The quick brown fox jumps over the lazy dog. It is a fine day.');
    expect(r.stats!.words).toBe(14);
    expect(r.stats!.sentences).toBe(2);
    expect(r.stats!.syllables!).toBeGreaterThan(0);
  });

  it('hides detail rows when showDetails is off', async () => {
    const on = table(await run('One two three. Four five six.'));
    const off = table(await run('One two three. Four five six.', { showDetails: false }));
    expect(on.rows.map((row) => row[0])).toContain('Words');
    expect(off.rows.map((row) => row[0])).not.toContain('Words');
    expect(off.rows).toHaveLength(4);
  });

  it('warns about short samples and explains the scales', async () => {
    const r = await run('Short text here.');
    expect(r.notes!.join(' ')).toMatch(/short sample/i);
    expect(r.notes!.join(' ')).toMatch(/plain english/i);
    expect(r.notes!.join(' ')).toMatch(/estimated/i);
  });

  it('rejects empty or wordless input', async () => {
    await expect(run('   ')).rejects.toThrow(/paste some text/i);
    await expect(run('123 456 !!! ???')).rejects.toThrow(/no words/i);
  });
});
