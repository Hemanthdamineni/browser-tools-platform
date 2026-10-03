import { describe, it, expect } from 'vitest';
import tool from './markdown-to-html.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string };

describe('markdown-to-html', async () => {
  it('converts a heading and paragraph to HTML source', async () => {
    expect((await run('# Title\n\nHello **world**.')).output).toBe(
      '<h1>Title</h1>\n<p>Hello <strong>world</strong>.</p>',
    );
  });

  it('empty input → empty output', async () => {
    expect((await run('')).output).toBe('');
  });

  it('gfm on: strikethrough becomes <del>', async () => {
    expect((await run('a ~~b~~ c', { gfm: true })).output).toContain('<del>b</del>');
  });

  it('gfm off: strikethrough left literal', async () => {
    const out = (await run('a ~~b~~ c', { gfm: false })).output;
    expect(out).toContain('~~b~~');
    expect(out).not.toContain('<del>');
  });

  it('breaks on: single newline becomes <br>', async () => {
    expect((await run('line1\nline2', { breaks: true })).output).toContain('<br>');
  });

  it('breaks off: single newline is not a <br>', async () => {
    expect((await run('line1\nline2', { breaks: false })).output).not.toContain('<br>');
  });

  it('headerIds on: headings get slugified ids', async () => {
    const out = (await run('# Hello World\n\n## Hello World', { headerIds: true })).output;
    expect(out).toContain('<h1 id="hello-world">Hello World</h1>');
    expect(out).toContain('<h2 id="hello-world-1">Hello World</h2>');
  });

  it('headerIds off: headings have no id', async () => {
    expect((await run('# Hello World', { headerIds: false })).output).toBe('<h1>Hello World</h1>');
  });

  it('output is flagged as html code', async () => {
    const res = (await tool.run({ text: '# x', options: {} })) as {
      render?: string;
      language?: string;
    };
    expect(res.render).toBe('code');
    expect(res.language).toBe('html');
  });

  it('throws ToolError on oversized input', async () => {
    await expect(run('x'.repeat(500_001))).rejects.toThrow(ToolError);
  });
});
