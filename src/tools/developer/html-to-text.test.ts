import { describe, it, expect } from 'vitest';
import tool from './html-to-text.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string };

describe('html-to-text', async () => {
  it('heading + paragraph become blank-line separated text', async () => {
    expect((await run('<h1>Title</h1><p>Hello <b>world</b></p>')).output).toBe(
      'Title\n\nHello world',
    );
  });

  it('empty input -> empty output', async () => {
    expect((await run('')).output).toBe('');
  });

  it('list items get a dash prefix', async () => {
    expect((await run('<ul><li>one</li><li>two</li></ul>')).output).toBe('- one\n\n- two');
  });

  it('<br> becomes a single newline', async () => {
    expect((await run('a<br>b<br/>c')).output).toBe('a\nb\nc');
  });

  it('decodes named, decimal and hex entities', async () => {
    expect((await run('<p>Tom &amp; Jerry &#169; &#x263A; &mdash; end</p>')).output).toBe(
      'Tom & Jerry © ☺ — end',
    );
  });

  it('drops <script> and <style> contents', async () => {
    expect(
      (await run('<style>p{color:red}</style><p>hi</p><script>var x = 1 > 0;</script>')).output,
    ).toBe('hi');
  });

  it('collapses runs of spaces and blank lines', async () => {
    expect((await run('<p>a    b</p>\n\n\n\n<p>c</p>')).output).toBe('a b\n\nc');
  });

  it('preserveLinks off (default): keeps only link text', async () => {
    expect((await run('<p>See <a href="https://example.com">our site</a> now</p>')).output).toBe(
      'See our site now',
    );
  });

  it('preserveLinks on: appends the href', async () => {
    expect(
      (
        await run('<p>See <a href="https://example.com">our site</a> now</p>', {
          preserveLinks: true,
        })
      ).output,
    ).toBe('See our site (https://example.com) now');
  });

  it('preserveImages off (default): image is removed', async () => {
    expect((await run('<p><img src="a.png" alt="A cat"> caption</p>')).output).toBe('caption');
  });

  it('preserveImages on: image becomes [alt]', async () => {
    expect(
      (await run('<p><img src="a.png" alt="A cat"> caption</p>', { preserveImages: true })).output,
    ).toBe('[A cat] caption');
  });

  it('throws ToolError on oversized input', async () => {
    await expect(run('x'.repeat(500_001))).rejects.toThrow(ToolError);
  });
});
