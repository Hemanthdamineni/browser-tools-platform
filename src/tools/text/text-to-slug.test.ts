import { describe, expect, it } from 'vitest';
import tool from './text-to-slug.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('text-to-slug', () => {
  it('produces a hyphen slug from mixed-case text', async () => {
    const r = await run('Hello World! How are you?');
    expect(r.output).toBe('hello-world-how-are-you');
  });

  it('transliterates accented characters', async () => {
    const r = await run('Crème brûlée — café au lait');
    expect(r.output).toBe('creme-brulee-cafe-au-lait');
  });

  it('handles ligatures and German sharp-s via override table', async () => {
    const r = await run('Straße & Ærø');
    expect(r.output).toBe('strasse-aero');
  });

  it('supports underscore separator and case preservation', async () => {
    const r = await run('Hello World', { separator: '_' });
    expect(r.output).toBe('hello_world');
    const upper = await run('Hello', { lowercase: false });
    expect(upper.output).toBe('Hello');
  });

  it('removes stopwords when enabled', async () => {
    const r = await run('The quick brown fox', { removeStopwords: true });
    expect(r.output).toBe('quick-brown-fox');
  });

  it('keeps stopwords and no-separator mode', async () => {
    const withWords = await run('The quick fox', { removeStopwords: false });
    expect(withWords.output).toBe('the-quick-fox');
    const noSep = await run('a b c', { separator: '' });
    expect(noSep.output).toBe('abc');
  });

  it('caps at maxLength on a word boundary and strips trailing separator', async () => {
    const r = await run('alpha beta gamma delta', { maxLength: 12 });
    expect(r.output.length).toBeLessThanOrEqual(12);
    expect(r.output).not.toMatch(/-$/);
  });

  it('rejects empty input', async () => {
    await expect(run('   ')).rejects.toThrow(/paste some text/i);
  });
});
