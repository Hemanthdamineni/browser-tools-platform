import { describe, expect, it } from 'vitest';
import tool from './html-to-markdown.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('html-to-markdown', () => {
  it('converts headings with ATX style', async () => {
    const r = await run('<h1>Title</h1><h2>Sub</h2><h3>Deep</h3>');
    expect(r.output).toContain('# Title');
    expect(r.output).toContain('## Sub');
    expect(r.output).toContain('### Deep');
  });

  it('converts inline emphasis', async () => {
    const r = await run('<p><strong>bold</strong>, <em>italic</em>, <del>gone</del></p>');
    expect(r.output).toContain('**bold**');
    expect(r.output).toContain('*italic*');
    expect(r.output).toContain('~~gone~~');
  });

  it('converts links inline by default', async () => {
    const r = await run('<p>See <a href="https://x.dev">docs</a> here.</p>');
    expect(r.output).toContain('[docs](https://x.dev)');
  });

  it('emits reference-style links and collects urls', async () => {
    const r = await run('Visit <a href="https://a.dev">A</a> and <a href="https://b.dev">B</a>.', {
      linkStyle: 'reference',
    });
    expect(r.output).toContain('[A][1]');
    expect(r.output).toContain('[B][2]');
    expect(r.output).toContain('[1]: https://a.dev');
    expect(r.output).toContain('[2]: https://b.dev');
  });

  it('deduplicates repeated reference urls', async () => {
    const r = await run('<a href="https://a.dev">a</a> <a href="https://a.dev">b</a>', {
      linkStyle: 'reference',
    });
    expect(r.output).toContain('[a][1]');
    expect(r.output).toContain('[b][1]');
    expect(r.output.match(/\[1\]:/g)?.length ?? 0).toBe(1);
  });

  it('keeps only text when link style is text', async () => {
    const r = await run('Go to <a href="https://x.dev">home</a>.', { linkStyle: 'text' });
    expect(r.output).toContain('Go to home.');
    expect(r.output).not.toContain('x.dev');
  });

  it('converts unordered and ordered lists', async () => {
    const ul = await run('<ul><li>One</li><li>Two</li></ul>');
    expect(ul.output).toContain('- One');
    expect(ul.output).toContain('- Two');
    const ol = await run('<ol><li>First</li><li>Second</li></ol>');
    expect(ol.output).toContain('1. First');
    expect(ol.output).toContain('2. Second');
  });

  it('converts code blocks and inline code', async () => {
    const r = await run('<p>Run <code>npm i</code></p><pre><code>const x = 1;</code></pre>');
    expect(r.output).toContain('`npm i`');
    expect(r.output).toContain('```\nconst x = 1;\n```');
  });

  it('converts blockquotes line by line', async () => {
    const r = await run('<blockquote>First line. <br> Second line.</blockquote>');
    expect(r.output).toContain('> First line.');
    expect(r.output).toContain('> Second line.');
  });

  it('strips comments, script, and style blocks', async () => {
    const r = await run(
      '<!-- hidden --><style>body{}</style><script>alert(1)</script><p>Visible</p>',
    );
    expect(r.output).not.toContain('hidden');
    expect(r.output).not.toContain('alert');
    expect(r.output).not.toContain('body{}');
    expect(r.output).toContain('Visible');
  });

  it('decodes entities and preserves image alt/src', async () => {
    const r = await run(
      '<p>A &amp; B &lt;3 &nbsp; &#169; 2026</p><img src="pic.png" alt="A photo">',
    );
    expect(r.output).toContain('A & B <3 © 2026');
    expect(r.output).toContain('![A photo](pic.png)');
  });

  it('converts table rows into pipe cells', async () => {
    const r = await run(
      '<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>',
    );
    expect(r.output).toContain('a | b |');
    expect(r.output).toContain('1 | 2 |');
  });

  it('supports setext headings', async () => {
    const r = await run('<h1>Head</h1><h3>Third</h3>', { headingStyle: 'setext' });
    expect(r.output).toMatch(/Head\n=+/);
    expect(r.output).toContain('### Third');
  });

  it('returns empty text when input is blank and errors on huge input', async () => {
    expect((await run('')).output).toBe('');
    await expect(run('x'.repeat(200_001))).rejects.toThrow(/too large/i);
  });

  it('reports stats', async () => {
    const r = await run('<h2>Hi</h2><ul><li>x</li></ul><a href="u">link</a>');
    expect(r.stats?.headings).toBe(1);
    expect(r.stats?.lists).toBe(1);
    expect(r.stats?.links).toBe(1);
  });
});
