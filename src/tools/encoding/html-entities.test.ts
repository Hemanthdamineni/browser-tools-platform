import { describe, it, expect } from 'vitest';
import tool from './html-entities.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string };

describe('html-entities', async () => {
  it('encodes the minimal set', async () => {
    const input = '<a href="#">Tom & Jerry\'s</a>';
    const expected = '&lt;a href=&quot;#&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;';
    expect((await run(input)).output).toBe(expected);
  });
  it('does not double-encode ampersands wrongly on round-trip', async () => {
    const s = 'a & b < c';
    const encoded = (await run(s)).output;
    expect((await run(encoded, { mode: 'decode' })).output).toBe(s);
  });
  it('encodes non-ASCII numerically when asked', async () => {
    expect((await run('café', { level: 'non-ascii' })).output).toBe('caf&#233;');
  });
  it('decodes named entities', async () => {
    expect((await run('5 < 10 && caf&eacute;', { mode: 'decode' })).output).toBe('5 < 10 && café');
  });
  it('decodes decimal and hex references', async () => {
    expect((await run('&#8212;&#x2014;', { mode: 'decode' })).output).toBe('——');
  });
  it('leaves unknown entities untouched', async () => {
    expect((await run('&notareal; &', { mode: 'decode' })).output).toBe('&notareal; &');
  });
  it('empty input', async () => {
    expect((await run('')).output).toBe('');
  });
});
