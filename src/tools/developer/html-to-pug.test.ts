import { describe, expect, it } from 'vitest';
import tool from './html-to-pug.tool';

type Result = { output: string; render?: string; language?: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('html-to-pug', () => {
  it('converts nested elements to indented selectors', async () => {
    const r = await run('<div><h2>Hello</h2><p>Body text</p></div>');
    expect(r.output).toBe('div\n  h2 Hello\n  p Body text\n');
    expect(r.language).toBe('pug');
  });

  it('collapses id and class attributes into shorthand', async () => {
    const r = await run('<div class="card big"><span id="title">Hi</span></div>');
    expect(r.output).toBe('.card.big\n  span#title Hi\n');
  });

  it('keeps other attributes and honours quote style', async () => {
    const double = await run('<a href="/x" target="_blank">Go</a>');
    expect(double.output).toBe('a(href="/x" target="_blank") Go\n');
    const single = await run('<a href="/x">Go</a>', { quoteStyle: 'single' });
    expect(single.output).toBe("a(href='/x') Go\n");
  });

  it('handles void elements without children', async () => {
    const r = await run('<div><img src="a.png" alt="A"><br></div>');
    expect(r.output).toBe('div\n  img(src="a.png" alt="A")\n  br\n');
  });

  it('emits raw text blocks for script and style', async () => {
    const r = await run('<div><script>var x = 1;\nif (x) { y(); }</script><style>.a { color: red; }</style></div>');
    expect(r.output).toContain('script.');
    expect(r.output).toContain('var x = 1;');
    expect(r.output).toContain('style.');
    expect(r.output).toContain('.a { color: red; }');
  });

  it('carries comments over as //- and can drop them', async () => {
    const kept = await run('<!-- note --><p>x</p>');
    expect(kept.output).toBe('//- note\np x\n');
    const dropped = await run('<!-- note --><p>x</p>', { keepComments: false });
    expect(dropped.output).toBe('p x\n');
  });

  it('indents with the configured width', async () => {
    const r = await run('<div><p>x</p></div>', { indentWidth: 4 });
    expect(r.output).toBe('div\n    p x\n');
  });

  it('decodes entities and handles custom elements', async () => {
    const r = await run('<my-widget data-x="1">a &amp; b</my-widget>');
    expect(r.output).toBe('my-widget(data-x="1") a & b\n');
  });

  it('reports warnings for malformed markup', async () => {
    const r = await run('<div><p>unclosed');
    expect(r.notes!.join(' ')).toMatch(/missing closing tag/i);
    expect(r.output).toContain('p unclosed');
  });

  it('rejects empty input and markup with no elements', async () => {
    await expect(run('   ')).rejects.toThrow(/paste some html/i);
    await expect(run('just text')).rejects.toThrow(/no html elements/i);
  });
});
