import { describe, expect, it } from 'vitest';
import tool from './html-entity.tool';

type Result = { output: string; stats?: Record<string, string | number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('html-entity', () => {
  it('auto-encodes text with markup', async () => {
    const r = await run('<script>alert("x")</script> & done');
    expect(r.output).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; done');
    expect((r.notes ?? []).join(' ')).toMatch(/[Ee]ncoded/);
  });

  it('auto-decodes text with entities', async () => {
    const r = await run('Tom &amp; Jerry &mdash; caf&eacute; &#169;');
    expect(r.output.trim()).toBe('Tom & Jerry — café ©');
  });

  it('honours an explicit mode', async () => {
    const enc = await run('a & b', { mode: 'encode' });
    expect(enc.output).toContain('a &amp; b');
    const dec = await run('&lt;b&gt;&amp;&nbsp;x', { mode: 'decode' });
    expect(dec.output.trim()).toBe('<b>&\u00A0x');
  });

  it('encodes all printable non-ASCII as numeric entities when requested', async () => {
    const r = await run('café ≤ 5', { mode: 'encode', encodeAll: true });
    expect(r.output).toContain('caf&#233; &#8804; 5');
    expect((r.notes ?? []).join(' ')).toMatch(/numeric entities/);
  });

  it('decodes hex numeric forms and leaves unknown entities alone', async () => {
    const r = await run('&#x41; &#65; &notreal;');
    expect(r.output.trim()).toBe('A A &notreal;');
  });

  it('escapes the apostrophe and rejects empty input', async () => {
    const r = await run("it's", { mode: 'encode' });
    expect(r.output).toContain('it&#39;s');
    await expect(run('   ')).rejects.toThrow(/paste text/i);
  });
});
