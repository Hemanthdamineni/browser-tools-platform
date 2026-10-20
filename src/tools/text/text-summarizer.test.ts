import { describe, expect, it } from 'vitest';
import tool, { splitSentences } from './text-summarizer.tool';

type Result = { output: string; render?: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };

const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;

const SAMPLE = [
  'Cats make wonderful pets.',
  'Many people love cats because cats are friendly.',
  'Cats can be trained to use a litter box.',
  'Some cats prefer to live outdoors.',
  'Overall cats bring joy to a home.',
].join(' ');

describe('text-summarizer', () => {
  it('returns the instructions on blank input', () => {
    const result = run('   ');
    expect(result.render).toBe('table');
    expect(result.notes?.join(' ')).toMatch(/paste a document/i);
  });

  it('rejects text that is too short', () => {
    expect(() => run('Hello world.')).toThrow(/too short/i);
  });

  it('picks the most representative sentence for a short summary', () => {
    const result = run(SAMPLE, { length: 'short' });
    // The sentence mentioning "cats" twice is the highest-scoring one.
    expect(result.output).toBe('Many people love cats because cats are friendly.');
  });

  it('returns a custom number of sentences in original order', () => {
    const result = run(SAMPLE, { length: 'custom', count: 3 });
    const sentences = result.output.split('. ').map((s) => s.trim());
    expect(sentences).toHaveLength(3);
    expect(result.output).toContain('Cats make wonderful pets.');
    expect(result.output.indexOf('Many people love cats')).toBeGreaterThan(result.output.indexOf('Cats make wonderful pets.'));
  });

  it('exposes a compression statistic', () => {
    const result = run(SAMPLE, { length: 'short' });
    expect(result.stats?.selected).toBe(1);
    expect(result.stats?.selected).toBeGreaterThanOrEqual(1);
    expect(typeof result.stats?.compression).toBe('number');
    expect(Number(result.stats?.compression)).toBeGreaterThan(0);
  });

  it('does not split on abbreviations, decimals or initials', () => {
    const text = 'Dr. Smith and Mr. Jones met at 3.14 pm. Then Dr. Smith left early.';
    expect(splitSentences(text)).toEqual(['Dr. Smith and Mr. Jones met at 3.14 pm.', 'Then Dr. Smith left early.']);
  });

  it('split sentences on terminators with uppercase or digit continuation', () => {
    expect(splitSentences('One. Two! Three? Four.')).toEqual(['One.', 'Two!', 'Three?', 'Four.']);
    expect(splitSentences('No boundary inside 3.14 here.')).toEqual(['No boundary inside 3.14 here.']);
  });

  it('sets a download filename', () => {
    expect(run(SAMPLE, { length: 'custom', count: 2 }).filename).toBe('summary.txt');
  });
});
