import { describe, it, expect } from 'vitest';
import tool from './html-entities.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string };

describe('html-entities', () => {
  it('encodes the minimal set', () => {
    expect(run('<a href="#">Tom & Jerry\'s</a>').output).toBe(
      '&lt;a href=&quot;#&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
    );
  });
  it('does not double-encode ampersands wrongly on round-trip', () => {
    const s = 'a & b < c';
    expect(run(run(s).output, { mode: 'decode' }).output).toBe(s);
  });
  it('encodes non-ASCII numerically when asked', () => {
    expect(run('café', { level: 'non-ascii' }).output).toBe('caf&#233;');
  });
  it('decodes named entities', () => {
    expect(run('5 &lt; 10 &amp;&amp; caf&eacute;', { mode: 'decode' }).output).toBe(
      '5 < 10 && café',
    );
  });
  it('decodes decimal and hex references', () => {
    expect(run('&#8212;&#x2014;', { mode: 'decode' }).output).toBe('——');
  });
  it('leaves unknown entities untouched', () => {
    expect(run('&notareal; &amp;', { mode: 'decode' }).output).toBe('&notareal; &');
  });
  it('empty input', () => {
    expect(run('').output).toBe('');
  });
});
