import { describe, it, expect } from 'vitest';
import tool from './text-stats.tool';

type Row = [string, string];

async function rows(text: string): Promise<Row[]> {
  const res = (await tool.run({ text, options: {} })) as { output: string; render?: string };
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
    expect(r).toHaveLength(25);
    expect(r.every((row) => row[1] === '0')).toBe(true);
  });

  describe('platform limits (at-limit vs one over)', () => {
    it('X/Twitter 280', async () => {
      expect(await value('a'.repeat(280), 'X (Twitter) — 280')).toBe('280 / 280 · at limit');
      expect(await value('a'.repeat(281), 'X (Twitter) — 280')).toBe('281 / 280 · 1 over');
      expect(await value('a'.repeat(279), 'X (Twitter) — 280')).toBe('279 / 280 · 1 left');
    });

    it('LinkedIn 3000', async () => {
      expect(await value('a'.repeat(3000), 'LinkedIn — 3000')).toBe('3000 / 3000 · at limit');
      expect(await value('a'.repeat(3001), 'LinkedIn — 3000')).toBe('3001 / 3000 · 1 over');
    });

    it('Instagram 2200', async () => {
      expect(await value('a'.repeat(2200), 'Instagram — 2200')).toBe('2200 / 2200 · at limit');
      expect(await value('a'.repeat(2201), 'Instagram — 2200')).toBe('2201 / 2200 · 1 over');
    });

    it('Meta description 155–160 band', async () => {
      expect(await value('a'.repeat(155), 'Meta description — 155–160')).toBe(
        '155 · within 155–160',
      );
      expect(await value('a'.repeat(160), 'Meta description — 155–160')).toBe(
        '160 · within 155–160',
      );
      expect(await value('a'.repeat(154), 'Meta description — 155–160')).toBe(
        '154 · 1 short of 155',
      );
      expect(await value('a'.repeat(161), 'Meta description — 155–160')).toBe('161 · 1 over 160');
    });

    it('SMS 160/segment', async () => {
      expect(await value('a'.repeat(160), 'SMS — 160/segment')).toBe('160 · 1 segment');
      expect(await value('a'.repeat(161), 'SMS — 160/segment')).toBe('161 · 2 segments');
      expect(await value('a'.repeat(320), 'SMS — 160/segment')).toBe('320 · 2 segments');
      expect(await value('a'.repeat(321), 'SMS — 160/segment')).toBe('321 · 3 segments');
    });
  });

  describe('readability scores', () => {
    // Syllable heuristic: a run of vowels (a,e,i,o,u,y) is one syllable; a final
    // silent "e" is dropped; each word counts at least one. Letter tokens keep
    // apostrophes/hyphens (e.g. "don't"). Below, syllable counts are per word.
    const p2 =
      'The quick brown fox jumps over the lazy dog near the river bank. The clever cat watched the busy fish swim.';
    // Words: 21, sentences: 2, syllables: 27, letters: 85, polysyllables: 0.
    // wps = 21/2 = 10.5; spw = 27/21; lpw = 85/21.
    // Flesch = 206.835 - 1.015*10.5 - 84.6*(27/21) = 87.4
    // Flesch-Kincaid = 0.39*10.5 + 11.8*(27/21) - 15.59 = 3.7
    // Gunning Fog = 0.4*(10.5 + 0) = 4.2
    // SMOG = 1.043*sqrt(30*0/2) + 3.1291 = 3.1
    // ARI = 4.71*(85/21) + 0.5*10.5 - 21.43 = 2.9
    // Coleman-Liau = 0.0588*(85/21*100) - 0.296*(2/21*100) - 15.8 = 5.2

    it('scores a plain, easy passage', async () => {
      expect(await value(p2, 'Syllables (estimated)')).toBe('27');
      expect(await value(p2, 'Syllables per word')).toBe('1.3');
      expect(await value(p2, 'Flesch Reading Ease')).toBe('87.4');
      expect(await value(p2, 'Flesch-Kincaid Grade')).toBe('3.7');
      expect(await value(p2, 'Gunning Fog')).toBe('4.2');
      expect(await value(p2, 'SMOG')).toBe('3.1');
      expect(await value(p2, 'ARI')).toBe('2.9');
      expect(await value(p2, 'Coleman-Liau')).toBe('5.2');
    });

    const p3 =
      'Reading is a helpful activity for every person. The talented writer produced an excellent chapter for the popular magazine.';
    // Words: 19, sentences: 2, syllables: 39, letters: 103, polysyllables: 7.
    // wps = 19/2 = 9.5; spw = 39/19; lpw = 103/19.
    // Flesch = 206.835 - 1.015*9.5 - 84.6*(39/19) = 23.5
    // Flesch-Kincaid = 0.39*9.5 + 11.8*(39/19) - 15.59 = 12.3
    // Gunning Fog = 0.4*(9.5 + 100*7/19) = 18.5
    // SMOG = 1.043*sqrt(30*7/2) + 3.1291 = 13.8
    // ARI = 4.71*(103/19) + 0.5*9.5 - 21.43 = 8.9
    // Coleman-Liau = 0.0588*(103/19*100) - 0.296*(2/19*100) - 15.8 = 13.0

    it('scores denser prose with polysyllabic words', async () => {
      expect(await value(p3, 'Syllables (estimated)')).toBe('39');
      expect(await value(p3, 'Syllables per word')).toBe('2.1');
      expect(await value(p3, 'Flesch Reading Ease')).toBe('23.5');
      expect(await value(p3, 'Flesch-Kincaid Grade')).toBe('12.3');
      expect(await value(p3, 'Gunning Fog')).toBe('18.5');
      expect(await value(p3, 'SMOG')).toBe('13.8');
      expect(await value(p3, 'ARI')).toBe('8.9');
      expect(await value(p3, 'Coleman-Liau')).toBe('13');
    });
  });
});
