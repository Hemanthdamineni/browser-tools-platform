import { describe, it, expect } from 'vitest';
import tool from './lorem-ipsum.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string; render?: string };

describe('lorem-ipsum', () => {
  it('words count=5 yields 5 space-separated words', () => {
    const out = run('', { unit: 'words', count: 5 }).output;
    expect(out.split(' ')).toHaveLength(5);
  });

  it('paragraphs count=2 as HTML contains <p> twice', () => {
    const out = run('', { unit: 'paragraphs', count: 2, format: 'html' }).output;
    expect(out.match(/<p>/g)).toHaveLength(2);
  });

  it('startWithLorem opens with the classic text', () => {
    const out = run('', { unit: 'paragraphs', count: 1, startWithLorem: true }).output;
    expect(out.startsWith('Lorem ipsum dolor sit amet')).toBe(true);
  });

  it('startWithLorem=false does not open with it', () => {
    const out = run('', { unit: 'paragraphs', count: 1, startWithLorem: false }).output;
    expect(out.startsWith('Lorem ipsum dolor sit amet')).toBe(false);
  });

  it('markdown list-items uses "- " bullets', () => {
    const out = run('', { unit: 'list-items', count: 4, format: 'markdown' }).output;
    expect(out.match(/^- /gm)).toHaveLength(4);
  });

  it('plain format renders as text, html as code', () => {
    expect(run('', { format: 'plain' }).render).toBe('text');
    expect(run('', { format: 'html' }).render).toBe('code');
  });

  it('count=1 works for every unit', () => {
    for (const unit of ['words', 'sentences', 'paragraphs', 'list-items']) {
      expect(run('', { unit, count: 1 }).output.length).toBeGreaterThan(0);
    }
  });
});
