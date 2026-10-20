import { describe, expect, it } from 'vitest';
import tool from './html-to-jsx.tool';

type Result = { output: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('html-to-jsx', () => {
  it('renames class to className', async () => {
    const r = await run('<div class="box">Hi</div>');
    expect(r.output).toContain('className="box"');
  });

  it('renames for, tabindex, readonly, colspan', async () => {
    const r = await run(
      '<label for="x">X</label><input tabindex="1" readonly><td colspan="2">c</td>',
    );
    expect(r.output).toContain('htmlFor="x"');
    expect(r.output).toContain('tabIndex="1"');
    expect(r.output).toContain('readOnly');
    expect(r.output).toContain('colSpan="2"');
  });

  it('self-closes void elements', async () => {
    const r = await run(
      '<img src="logo.png"><input type="text"><br><hr><meta charset="utf-8"><link rel="stylesheet" href="s.css">',
    );
    expect(r.output).toContain('<img src="logo.png" />');
    expect(r.output).toContain('<input type="text" />');
    expect(r.output).toContain('<br />');
    expect(r.output).toContain('<hr />');
    expect(r.output).toContain('<link rel="stylesheet" href="s.css" />');
    expect(r.output).toContain('/>');
  });

  it('keeps boolean attributes bare', async () => {
    const r = await run('<button disabled>Save</button>');
    expect(r.output).toContain('<button disabled>Save</button>');
    expect(r.output).not.toContain('disabled=""');
  });

  it('renders mixed text and inline elements on one line', async () => {
    const r = await run('<p>Hello <b>world</b>!</p>');
    expect(r.output).toContain('<p>Hello <b>world</b>!</p>');
  });

  it('indents nested element-only trees', async () => {
    const r = await run('<div><nav><a href="/">Home</a></nav></div>');
    expect(r.output).toContain('<div>');
    expect(r.output).toContain('  <nav>');
    expect(r.output).toContain('    <a href="/">Home</a>');
  });

  it('wraps multiple roots in a fragment without stray indentation', async () => {
    const r = await run('<h1>T</h1><p>P</p>');
    expect(r.output).toContain('<>\n  <h1>T</h1>\n  <p>P</p>\n</>');
  });

  it('converts comments to {/* */} and removes them when disabled', async () => {
    const src = '<div><!-- note --><span>x</span></div>';
    const kept = await run(src);
    expect(kept.output).toContain('{/* note */}');
    const removed = await run(src, { preserveComments: false });
    expect(removed.output).not.toContain('/*');
    expect(removed.output).toContain('<span>x</span>');
  });

  it('escapes double quotes inside single-quoted attributes', async () => {
    const r = await run('<a title=\'say "hi"\'>t</a>');
    expect(r.output).toContain('title={"say \\"hi\\""}');
  });

  it('rejects malformed input', async () => {
    await expect(run('<div>')).rejects.toThrow(/Could not read the HTML/);
    await expect(run('<p><span></p>')).rejects.toThrow(/Could not read the HTML/);
    await expect(run('   ')).rejects.toThrow(/Paste some HTML/i);
  });

  it('handles inline comment elements', async () => {
    const r = await run('<p>a<!-- c -->b</p>');
    expect(r.output).toContain('{/* c */}');
    expect(r.output).toContain('</p>');
  });
});
