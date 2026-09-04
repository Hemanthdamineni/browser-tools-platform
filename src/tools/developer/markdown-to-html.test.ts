import { describe, it, expect } from 'vitest';
import tool from './markdown-to-html.tool';
import { ToolError } from '@/lib/types';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string };

describe('markdown-to-html', () => {
  it('converts a heading and paragraph to HTML source', () => {
    expect(run('# Title\n\nHello **world**.').output).toBe(
      '<h1>Title</h1>\n<p>Hello <strong>world</strong>.</p>',
    );
  });

  it('empty input → empty output', () => {
    expect(run('').output).toBe('');
  });

  it('gfm on: strikethrough becomes <del>', () => {
    expect(run('a ~~b~~ c', { gfm: true }).output).toContain('<del>b</del>');
  });

  it('gfm off: strikethrough left literal', () => {
    const out = run('a ~~b~~ c', { gfm: false }).output;
    expect(out).toContain('~~b~~');
    expect(out).not.toContain('<del>');
  });

  it('breaks on: single newline becomes <br>', () => {
    expect(run('line1\nline2', { breaks: true }).output).toContain('<br>');
  });

  it('breaks off: single newline is not a <br>', () => {
    expect(run('line1\nline2', { breaks: false }).output).not.toContain('<br>');
  });

  it('headerIds on: headings get slugified ids', () => {
    const out = run('# Hello World\n\n## Hello World', { headerIds: true }).output;
    expect(out).toContain('<h1 id="hello-world">Hello World</h1>');
    expect(out).toContain('<h2 id="hello-world-1">Hello World</h2>');
  });

  it('headerIds off: headings have no id', () => {
    expect(run('# Hello World', { headerIds: false }).output).toBe('<h1>Hello World</h1>');
  });

  it('output is flagged as html code', () => {
    const res = tool.run({ text: '# x', options: {} }) as { render?: string; language?: string };
    expect(res.render).toBe('code');
    expect(res.language).toBe('html');
  });

  it('throws ToolError on oversized input', () => {
    expect(() => run('x'.repeat(500_001))).toThrow(ToolError);
  });
});
