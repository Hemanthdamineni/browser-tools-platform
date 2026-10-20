import { describe, expect, it } from 'vitest';
import tool from './html-prettifier.tool';

type Result = { output: string; render?: string; language?: string; stats?: Record<string, number> };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('html-prettifier', () => {
  it('indents nested block elements', async () => {
    const r = await run('<div class="hero"><h1>Hello</h1><p>World</p></div>');
    expect(r.output).toBe(
      ['<div class="hero">', '  <h1>Hello</h1>', '  <p>World</p>', '</div>'].join('\n'),
    );
    expect(r.render).toBe('code');
    expect(r.language).toBe('html');
  });

  it('keeps simple inline content on one line', async () => {
    const r = await run('<p>Hello <b>world</b>!</p>');
    expect(r.output).toBe('<p>Hello <b>world</b>!</p>');
  });

  it('preserves significant whitespace between inline elements', async () => {
    const r = await run('<p><b>a</b> <i>b</i></p>');
    expect(r.output).toBe('<p><b>a</b> <i>b</i></p>');
  });

  it('never re-indents pre content', async () => {
    const r = await run('<pre>  keep\n  this\n</pre>');
    expect(r.output).toBe('<pre>  keep\n  this\n</pre>');
  });

  it('copies script content verbatim including < characters', async () => {
    const src = '<script>if (a<b) { x(); }</script>';
    const r = await run(src);
    expect(r.output).toBe(src);
  });

  it('wraps long opening tags into one attribute per line', async () => {
    const r = await run(
      '<div class="a-very-long-class-name" data-x="1" id="some-id">text</div>',
      { inlineMax: 40 },
    );
    const lines = r.output.split('\n');
    expect(lines[0]).toBe('<div');
    expect(lines).toContain('  class="a-very-long-class-name"');
    expect(lines).toContain('  data-x="1"');
    expect(lines).toContain('  id="some-id">');
    expect(lines[lines.length - 1]).toBe('</div>');
  });

  it('supports tabs and zero indent', async () => {
    const tabs = await run('<div><p>a</p></div>', { tabs: true });
    expect(tabs.output).toBe('<div>\n\t<p>a</p>\n</div>');
    const none = await run('<div><p>a</p></div>', { indent: 0 });
    expect(none.output).toBe('<div>\n<p>a</p>\n</div>');
  });

  it('honors the comment re-indent option', async () => {
    const src = '<p>text <!-- c --> more</p>';
    const inline = await run(src);
    expect(inline.output).toBe(src);
    const pretty = await run(src, { prettyComments: true });
    expect(pretty.output.split('\n')).toEqual(['<p>', '  text', '  <!-- c -->', '  more', '</p>']);
  });

  it('handles void and self-closing tags inline', async () => {
    const r = await run('<img src="a.png"><br>');
    expect(r.output).toBe('<img src="a.png"><br>');
    const nested = await run('<div><br></div>');
    expect(nested.output).toBe('<div><br></div>');
  });

  it('formats malformed markup without throwing', async () => {
    const r = await run('<div><p>a</div>');
    expect(r.output).toContain('<p>a</p>');
    expect(r.output.split('\n')[0]).toBe('<div>');
  });

  it('reports stats and errors on empty input', async () => {
    const r = await run('<div>a</div>');
    expect(r.stats?.originalBytes).toBeGreaterThan(0);
    expect(r.stats?.prettyBytes).toBeGreaterThan(0);
    await expect(run('   ')).rejects.toThrow(/html/i);
  });
});
