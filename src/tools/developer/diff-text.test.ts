import { describe, it, expect } from 'vitest';
import tool from './diff-text.tool';

type Res = { output: string; stats?: Record<string, string | number>; notes?: string[] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  await tool.run({ text, options }) as Res;

const call = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  await tool.run({ text, options }) as Res;

describe('diff-text', async () => {
  it('empty A and B → empty output', async () => {
    expect((await run('', { second: '' })).output).toBe('');
  });

  it('identical texts → empty output with a note', async () => {
    const res = await call('same\ntext', { second: 'same\ntext' });
    expect(res.output).toBe('');
    expect(res.notes?.[0]).toMatch(/identical/i);
    expect(res.stats?.additions).toBe(0);
    expect(res.stats?.deletions).toBe(0);
  });

  it('produces a unified line diff by default', async () => {
    expect((await run('apple\nbanana\ncherry', { second: 'apple\nBANANA\ncherry' })).output).toBe(
      ['--- A', '+++ B', '@@ -1,3 +1,3 @@', ' apple', '-banana', '+BANANA', ' cherry'].join('\n'),
    );
  });

  it('counts additions and deletions for line granularity', async () => {
    const res = await call('a\nb\nc\n', { second: 'a\nc\nd\ne\n' });
    expect(res.stats?.additions).toBe(2);
    expect(res.stats?.deletions).toBe(1);
  });

  it('renders an inline line diff', async () => {
    expect(
      (await run('apple\nbanana\ncherry', {
        second: 'apple\nBANANA\ncherry',
        format: 'inline',
      })).output,
    ).toBe('apple\n[-banana-]\n{+BANANA+}\ncherry');
  });

  it('renders an inline word diff', async () => {
    const res = await call('the quick brown fox', {
      second: 'the slow brown fox',
      granularity: 'words',
      format: 'inline',
    });
    expect(res.output).toBe('the [-quick-]{+slow+} brown fox');
    expect(res.stats?.additions).toBe(1);
    expect(res.stats?.deletions).toBe(1);
  });

  it('renders a unified word diff', async () => {
    expect(
      (await run('the quick brown fox', {
        second: 'the slow brown fox',
        granularity: 'words',
        format: 'unified',
      })).output,
    ).toBe(['--- A', '+++ B', '@@ word-level diff @@', '-quick', '+slow'].join('\n'));
  });

  it('renders an inline character diff and counts characters', async () => {
    const res = await call('kitten', {
      second: 'sitting',
      granularity: 'chars',
      format: 'inline',
    });
    expect(res.output).toBe('[-k-]{+s+}itt[-e-]{+i+}n{+g+}');
    expect(res.stats?.additions).toBe(3);
    expect(res.stats?.deletions).toBe(2);
  });

  it('renders a unified character diff', async () => {
    expect((await run('kitten', { second: 'sitting', granularity: 'chars', format: 'unified' })).output).toBe(
      ['--- A', '+++ B', '@@ character-level diff @@', '-k', '+s', '-e', '+i', '+g'].join('\n'),
    );
  });

  it('treats an empty B as an all-deletions diff', async () => {
    const res = await call('one\ntwo', { second: '' });
    expect(res.stats?.deletions).toBe(2);
    expect(res.stats?.additions).toBe(0);
    expect(res.output).toContain('-one');
    expect(res.output).toContain('-two');
  });

  it('reports render kind diff', async () => {
    const res = await tool.run({
      text: 'x',
      options: { second: 'y' },
    }) as { render?: string };
    expect(res.render).toBe('diff');
  });
});