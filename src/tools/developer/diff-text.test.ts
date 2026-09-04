import { describe, it, expect } from 'vitest';
import tool from './diff-text.tool';

type Res = { output: string; stats?: Record<string, string | number>; notes?: string[] };
const call = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Res;
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  call(text, options).output;

describe('diff-text', () => {
  it('empty A and B → empty output', () => {
    expect(run('', { second: '' })).toBe('');
  });

  it('identical texts → empty output with a note', () => {
    const res = call('same\ntext', { second: 'same\ntext' });
    expect(res.output).toBe('');
    expect(res.notes?.[0]).toMatch(/identical/i);
    expect(res.stats?.additions).toBe(0);
    expect(res.stats?.deletions).toBe(0);
  });

  it('produces a unified line diff by default', () => {
    expect(run('apple\nbanana\ncherry', { second: 'apple\nBANANA\ncherry' })).toBe(
      ['--- A', '+++ B', '@@ -1,3 +1,3 @@', ' apple', '-banana', '+BANANA', ' cherry'].join('\n'),
    );
  });

  it('counts additions and deletions for line granularity', () => {
    const res = call('a\nb\nc\n', { second: 'a\nc\nd\ne\n' });
    expect(res.stats?.additions).toBe(2);
    expect(res.stats?.deletions).toBe(1);
  });

  it('renders an inline line diff', () => {
    expect(
      run('apple\nbanana\ncherry', {
        second: 'apple\nBANANA\ncherry',
        format: 'inline',
      }),
    ).toBe('apple\n[-banana-]\n{+BANANA+}\ncherry');
  });

  it('renders an inline word diff', () => {
    const res = call('the quick brown fox', {
      second: 'the slow brown fox',
      granularity: 'words',
      format: 'inline',
    });
    expect(res.output).toBe('the [-quick-]{+slow+} brown fox');
    expect(res.stats?.additions).toBe(1);
    expect(res.stats?.deletions).toBe(1);
  });

  it('renders a unified word diff', () => {
    expect(
      run('the quick brown fox', {
        second: 'the slow brown fox',
        granularity: 'words',
        format: 'unified',
      }),
    ).toBe(['--- A', '+++ B', '@@ word-level diff @@', '-quick', '+slow'].join('\n'));
  });

  it('renders an inline character diff and counts characters', () => {
    const res = call('kitten', {
      second: 'sitting',
      granularity: 'chars',
      format: 'inline',
    });
    expect(res.output).toBe('[-k-]{+s+}itt[-e-]{+i+}n{+g+}');
    expect(res.stats?.additions).toBe(3);
    expect(res.stats?.deletions).toBe(2);
  });

  it('renders a unified character diff', () => {
    expect(run('kitten', { second: 'sitting', granularity: 'chars', format: 'unified' })).toBe(
      ['--- A', '+++ B', '@@ character-level diff @@', '-k', '+s', '-e', '+i', '+g'].join('\n'),
    );
  });

  it('treats an empty B as an all-deletions diff', () => {
    const res = call('one\ntwo', { second: '' });
    expect(res.stats?.deletions).toBe(2);
    expect(res.stats?.additions).toBe(0);
    expect(res.output).toContain('-one');
    expect(res.output).toContain('-two');
  });

  it('reports render kind diff', () => {
    const res = tool.run({
      text: 'x',
      options: { second: 'y' },
    }) as { render?: string };
    expect(res.render).toBe('diff');
  });
});
