import { describe, it, expect } from 'vitest';
import tool, {
  MAX_INPUT_CHARS,
  applyCodeHighlighting,
  buildExportDocument,
  buildPreviewDocument,
  buildPrintFragment,
  decodeEntities,
  documentStats,
  documentStyles,
  extractCodeBlocks,
  extractCodeFences,
  extractTitle,
  headingSlug,
  isSafeUrl,
  plainCodeBlock,
  renderMarkdown,
  replaceCodeBlocks,
  sanitizeHtml,
} from './markdown-preview.tool';
import { normalizeLanguage, resolveTheme } from './markdown-preview.highlight';
import { ToolError } from '@/lib/types';

const DEFAULTS = { gfm: true, breaks: false, headerIds: false };

const render = (source: string, options: Partial<typeof DEFAULTS> = {}) =>
  renderMarkdown(source, { ...DEFAULTS, ...options });

/* -------------------------------------------------------------------------- */
/*  Rendering                                                                   */
/* -------------------------------------------------------------------------- */

describe('renderMarkdown', () => {
  it('turns a heading and a paragraph into HTML', () => {
    expect(render('# Title\n\nHello **world**.')).toBe(
      '<h1>Title</h1>\n<p>Hello <strong>world</strong>.</p>',
    );
  });

  it('returns an empty string for empty input', () => {
    expect(render('')).toBe('');
  });

  it('gfm on: a table becomes a real table', () => {
    const html = render('| a | b |\n| - | - |\n| 1 | 2 |', { gfm: true });
    expect(html).toContain('<table>');
    expect(html).toContain('<th>a</th>');
  });

  it('gfm off: a table stays literal text', () => {
    const html = render('| a | b |\n| - | - |\n| 1 | 2 |', { gfm: false });
    expect(html).not.toContain('<table>');
    expect(html).toContain('| a | b |');
  });

  it('gfm on: strikethrough and task lists are rendered', () => {
    expect(render('a ~~b~~ c', { gfm: true })).toContain('<del>b</del>');
    expect(render('- [x] done', { gfm: true })).toContain('type="checkbox"');
  });

  it('gfm off: strikethrough is left alone', () => {
    const html = render('a ~~b~~ c', { gfm: false });
    expect(html).toContain('~~b~~');
    expect(html).not.toContain('<del>');
  });

  it('breaks on: a single newline becomes a hard break', () => {
    expect(render('line1\nline2', { breaks: true })).toContain('<br>');
  });

  it('breaks off: a single newline is not a hard break', () => {
    expect(render('line1\nline2', { breaks: false })).not.toContain('<br>');
  });

  it('headerIds on: headings get slugified ids', () => {
    const html = render('# Getting Started\n\n## Install Steps', { headerIds: true });
    expect(html).toContain('<h1 id="getting-started">Getting Started</h1>');
    expect(html).toContain('<h2 id="install-steps">Install Steps</h2>');
  });

  it('headerIds on: repeated headings get a numeric suffix', () => {
    const html = render('# Hello World\n\n## Hello World\n\n### Hello World', {
      headerIds: true,
    });
    expect(html).toContain('id="hello-world"');
    expect(html).toContain('id="hello-world-1"');
    expect(html).toContain('id="hello-world-2"');
  });

  it('headerIds off: headings have no id', () => {
    expect(render('# Hello World', { headerIds: false })).toBe('<h1>Hello World</h1>');
  });

  it('keeps emoji and other Unicode intact', () => {
    const html = render('# Café ☕️\n\nEmoji stay: 🎉 done');
    expect(html).toContain('Café ☕️');
    expect(html).toContain('🎉 done');
  });

  it('slugifies headings with punctuation and accents', () => {
    expect(headingSlug('<em>Hello, World!</em>')).toBe('hello-world');
    expect(headingSlug('Café & Bar')).toBe('café-bar');
    expect(headingSlug('***')).toBe('');
  });

  it('survives malformed Markdown without throwing', () => {
    const html = render('# Unclosed\n\n**bold ** text\n\n| broken | table');
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('Unclosed');
  });

  it('renders a very large document', () => {
    const source = Array.from({ length: 5000 }, (_, i) => `Paragraph ${i} with **bold**.`).join(
      '\n\n',
    );
    const html = render(source);
    expect(html.startsWith('<p>Paragraph 0 with <strong>bold</strong>.</p>')).toBe(true);
    expect(html).toContain('Paragraph 4999');
  });

  it('does not leak the options into the next call', () => {
    render('a ~~b~~', { gfm: false });
    expect(render('a ~~b~~')).toContain('<del>b</del>');
  });
});

/* -------------------------------------------------------------------------- */
/*  Code fences                                                                 */
/* -------------------------------------------------------------------------- */

describe('extractCodeFences', () => {
  it('reads the language of every fence', () => {
    const fences = extractCodeFences('```js\nconst a = 1;\n```\n\n```python\nprint(1)\n```');
    expect(fences).toHaveLength(2);
    expect(fences[0]).toEqual({ language: 'js', code: 'const a = 1;' });
    expect(fences[1]).toEqual({ language: 'python', code: 'print(1)' });
  });

  it('reports an empty language for a fence without one', () => {
    expect(extractCodeFences('```\nplain\n```')).toEqual([{ language: '', code: 'plain' }]);
  });

  it('lower-cases the language and ignores the rest of the info string', () => {
    expect(extractCodeFences('```JS title="x"\ncode\n```')[0]?.language).toBe('js');
  });

  it('treats an unterminated fence as code up to the end of the document', () => {
    const fences = extractCodeFences('```py\nprint(1)\nprint(2)');
    expect(fences).toEqual([{ language: 'py', code: 'print(1)\nprint(2)' }]);
  });

  it('does not treat an indented code block as a fence', () => {
    expect(extractCodeFences('    indented code\n')).toEqual([]);
  });

  it('finds no fences in an empty document', () => {
    expect(extractCodeFences('')).toEqual([]);
  });

  it('supports tilde fences', () => {
    expect(extractCodeFences('~~~ruby\nputs 1\n~~~')[0]).toEqual({
      language: 'ruby',
      code: 'puts 1',
    });
  });
});

describe('extractCodeBlocks', () => {
  it('reads the code and the language out of a rendered fragment', () => {
    const html = render('```js\nconst a = "<b>";\n```');
    const blocks = extractCodeBlocks(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.language).toBe('js');
    expect(blocks[0]?.code).toBe('const a = "<b>";\n');
  });

  it('finds a fence without a language', () => {
    const blocks = extractCodeBlocks(render('```\nplain\n```'));
    expect(blocks[0]).toEqual({ language: '', code: 'plain\n' });
  });
});

describe('replaceCodeBlocks', () => {
  it('replaces every block and hands the index over', () => {
    const html = render('```js\na\n```\n\n```py\nb\n```');
    const seen: string[] = [];
    const out = replaceCodeBlocks(html, (block, index) => {
      seen.push(`${index}:${block.language}`);
      return `<pre data-index="${index}"></pre>`;
    });
    expect(seen).toEqual(['0:js', '1:py']);
    expect(out).toContain('<pre data-index="0"></pre>');
    expect(out).toContain('<pre data-index="1"></pre>');
  });
});

describe('applyCodeHighlighting', () => {
  const html = '<pre><code class="language-js">const a = 1;\n</code></pre>';

  it('replaces a code block with the highlighted markup', () => {
    const out = applyCodeHighlighting(html, () => '<pre class="shiki">const a = 1;</pre>');
    expect(out).toBe('<pre class="shiki">const a = 1;</pre>');
  });

  it('passes the unescaped code and the language to the highlighter', () => {
    const seen: [string, string][] = [];
    applyCodeHighlighting('<pre><code class="language-js">a &lt; b</code></pre>', (code, language) => {
      seen.push([code, language]);
      return null;
    });
    expect(seen).toEqual([['a < b', 'js']]);
  });

  it('keeps the plain block when the highlighter fails', () => {
    const out = applyCodeHighlighting(html, () => {
      throw new Error('boom');
    });
    expect(out).toBe(html);
  });

  it('keeps the plain block when the highlighter returns nothing', () => {
    expect(applyCodeHighlighting(html, () => null)).toBe(html);
  });

  it('does not touch a fence without a language', () => {
    const plain = '<pre><code>plain</code></pre>';
    expect(applyCodeHighlighting(plain, () => '<pre>x</pre>')).toBe(plain);
  });
});

describe('plainCodeBlock', () => {
  it('re-escapes the code and keeps the language class', () => {
    expect(plainCodeBlock({ language: 'js', code: 'a < b' })).toBe(
      '<pre><code class="language-js">a &lt; b</code></pre>',
    );
  });
});

describe('normalizeLanguage', () => {
  it('maps the common aliases', () => {
    expect(normalizeLanguage('js')).toBe('javascript');
    expect(normalizeLanguage('TS')).toBe('typescript');
    expect(normalizeLanguage('sh')).toBe('bash');
    expect(normalizeLanguage('py')).toBe('python');
    expect(normalizeLanguage('yml')).toBe('yaml');
  });

  it('treats plain text as the language the core knows', () => {
    expect(normalizeLanguage('text')).toBe('text');
    expect(normalizeLanguage('txt')).toBe('text');
  });

  it('returns null for an empty or unknown language', () => {
    expect(normalizeLanguage('')).toBeNull();
    expect(normalizeLanguage('brainfuck')).toBeNull();
  });
});

describe('resolveTheme', () => {
  it('follows the page theme for "auto"', () => {
    expect(resolveTheme('auto', 'dark')).toBe('github-dark');
    expect(resolveTheme('auto', 'light')).toBe('github-light');
  });

  it('uses an explicit theme as-is', () => {
    expect(resolveTheme('nord', 'light')).toBe('nord');
  });

  it('falls back to a light theme for an unknown name', () => {
    expect(resolveTheme('nope', 'dark')).toBe('github-light');
  });
});

/* -------------------------------------------------------------------------- */
/*  Sanitising                                                                  */
/* -------------------------------------------------------------------------- */

describe('sanitizeHtml', () => {
  it('removes a script element and its content', () => {
    const out = sanitizeHtml('<p>before</p><script>alert(1)</script><p>after</p>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('<p>before</p>');
    expect(out).toContain('<p>after</p>');
  });

  it('removes an event handler attribute', () => {
    const out = sanitizeHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('<img src="x">');
  });

  it('removes a javascript: URL from a link', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('click');
  });

  it('removes a data: URL from a src', () => {
    const out = sanitizeHtml('<img src="data:text/html;base64,PHNjcmlwdD4=">');
    expect(out).not.toContain('data:');
  });

  it('removes a javascript: URL that is hidden behind entities', () => {
    expect(sanitizeHtml('<a href="java&#115;cript:alert(1)">x</a>')).not.toContain('script:');
    expect(sanitizeHtml('<a href="javascript&colon;alert(1)">x</a>')).not.toContain('alert');
  });

  it('removes a javascript: URL that is hidden behind control characters', () => {
    expect(sanitizeHtml('<a href="java\tscript:alert(1)">x</a>')).not.toContain('script:');
  });

  it('removes the dangerous container elements', () => {
    const out = sanitizeHtml(
      '<iframe src="https://evil.example"></iframe>' +
        '<object data="x.swf"></object>' +
        '<embed src="x.swf">' +
        '<link rel="stylesheet" href="https://evil.example/x.css">' +
        '<meta http-equiv="refresh" content="0;url=https://evil.example">' +
        '<base href="https://evil.example/">',
    );
    for (const tag of ['<iframe', '<object', '<embed', '<link', '<meta', '<base']) {
      expect(out).not.toContain(tag);
    }
  });

  it('keeps ordinary content unchanged', () => {
    const html =
      '<h1 id="x">Title</h1>\n<p>Hello <strong>world</strong> &amp; friends.</p>\n' +
      '<ul><li>one</li><li>two</li></ul>\n<pre><code>const a = 1;</code></pre>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('keeps an ordinary https link', () => {
    expect(sanitizeHtml('<a href="https://example.com/x">x</a>')).toBe(
      '<a href="https://example.com/x">x</a>',
    );
  });

  it('keeps a relative link', () => {
    expect(sanitizeHtml('<a href="/docs/x.md">x</a>')).toBe('<a href="/docs/x.md">x</a>');
  });

  it('drops a style element with its content', () => {
    const out = sanitizeHtml('<style>body{display:none}</style><p>x</p>');
    expect(out).not.toContain('display:none');
    expect(out).toContain('<p>x</p>');
  });

  it('drops comments and doctypes', () => {
    expect(sanitizeHtml('<!-- secret --><p>x</p>')).toBe('<p>x</p>');
    expect(sanitizeHtml('<!doctype html><p>x</p>')).toBe('<p>x</p>');
  });

  it('does not let a stray angle bracket open a tag', () => {
    expect(sanitizeHtml('<p>a < b</p>')).toBe('<p>a &lt; b</p>');
  });

  it('keeps a textarea element inert', () => {
    const out = sanitizeHtml('<textarea><script>alert(1)</script></textarea>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('returns an empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('neutralises the three classic payloads in one document', () => {
    const out = sanitizeHtml(
      '<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a>',
    );
    expect(out).not.toContain('<script');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('javascript:');
  });
});

describe('isSafeUrl', () => {
  it('rejects the dangerous schemes', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('JavaScript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,<script>')).toBe(false);
    expect(isSafeUrl('vbscript:msgbox')).toBe(false);
  });

  it('accepts the ordinary ones', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('mailto:a@example.com')).toBe(true);
    expect(isSafeUrl('/relative/path')).toBe(true);
    expect(isSafeUrl('#anchor')).toBe(true);
    expect(isSafeUrl('')).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  Documents                                                                   */
/* -------------------------------------------------------------------------- */

describe('documentStats', () => {
  it('counts the words, the headings, the code blocks and the links', () => {
    const stats = documentStats('# Title\n\nOne two three.\n\n```js\ncode\n```\n\n[link](https://x)');
    expect(stats.words).toBe(7);
    expect(stats.headings).toBe(1);
    expect(stats.codeBlocks).toBe(2);
    expect(stats.links).toBe(1);
    expect(stats.characters).toBeGreaterThan(0);
  });

  it('is empty for an empty document', () => {
    expect(documentStats('')).toMatchObject({ characters: 0, words: 0, headings: 0, links: 0 });
  });
});

describe('extractTitle', () => {
  it('uses the first heading', () => {
    expect(extractTitle('# Hello *world*\n\ntext')).toBe('Hello world');
  });

  it('falls back to the first non-empty line', () => {
    expect(extractTitle('just a line\n\nmore')).toBe('just a line');
  });

  it('falls back to the default', () => {
    expect(extractTitle('')).toBe('Markdown document');
  });
});

describe('buildExportDocument', () => {
  it('wraps the body in a complete, self-contained document', () => {
    const doc = buildExportDocument({ title: 'My notes', body: '<p>Hello</p>' });
    expect(doc.startsWith('<!doctype html>')).toBe(true);
    expect(doc).toContain('<title>My notes</title>');
    expect(doc).toContain('<p>Hello</p>');
    expect(doc).toContain('<style>');
  });

  it('contains no external references', () => {
    const doc = buildExportDocument({ title: 'x', body: '<p>Hello</p>' });
    expect(doc).not.toMatch(/<script/i);
    expect(doc).not.toMatch(/<link/i);
    expect(doc).not.toMatch(/https?:\/\//);
  });

  it('escapes the title', () => {
    expect(
      buildExportDocument({ title: '<script>alert(1)</script>', body: '<p>x</p>' }),
    ).toContain('&lt;script&gt;');
  });

  it('honours the dark theme', () => {
    expect(buildExportDocument({ title: 'x', body: '<p>x</p>', theme: 'dark' })).toContain(
      'data-theme="dark"',
    );
    expect(buildExportDocument({ title: 'x', body: '<p>x</p>', theme: 'light' })).toContain(
      'data-theme="light"',
    );
  });

  it('carries a content-security policy that blocks the network', () => {
    const doc = buildExportDocument({ title: 'x', body: '<p>x</p>' });
    expect(doc).toContain('Content-Security-Policy');
    expect(doc).toContain("default-src 'none'");
  });
});

describe('buildPreviewDocument', () => {
  it('carries a content-security policy that blocks scripts and the network', () => {
    const doc = buildPreviewDocument('<p>Hello</p>');
    expect(doc).toContain('Content-Security-Policy');
    expect(doc).toContain("default-src 'none'");
    expect(doc).toContain("script-src 'none'");
  });

  it('keeps the body and the stylesheet', () => {
    const doc = buildPreviewDocument('<p>Hello</p>', 'dark');
    expect(doc).toContain('<p>Hello</p>');
    expect(doc).toContain('data-theme="dark"');
    expect(doc).toContain('.markdown-body');
  });
});

describe('buildPrintFragment', () => {
  it('scopes the stylesheet to the print root', () => {
    const fragment = buildPrintFragment('<p>Hello</p>');
    expect(fragment).toContain('class="markdown-body"');
    expect(fragment).toContain('.markdown-body h1');
    expect(fragment).not.toMatch(/^h1 \{/m);
  });
});

describe('documentStyles', () => {
  it('keeps every rule inside the scope', () => {
    const styles = documentStyles('.markdown-body');
    expect(styles).toContain('.markdown-body h1');
    expect(styles).not.toMatch(/^h1 \{/m);
  });
});

/* -------------------------------------------------------------------------- */
/*  The tool                                                                    */
/* -------------------------------------------------------------------------- */

describe('markdown-preview', () => {
  const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
    (await tool.run({ text, options })) as {
      output: string;
      render?: string;
      language?: string;
      stats?: Record<string, string | number>;
    };

  it('returns the filtered HTML as the output', async () => {
    const result = await run('# Title\n\nHello **world**.', { headerIds: false });
    expect(result.output).toBe('<h1>Title</h1>\n<p>Hello <strong>world</strong>.</p>');
    expect(result.render).toBe('code');
    expect(result.language).toBe('html');
  });

  it('returns an empty output for empty input', async () => {
    expect((await run('')).output).toBe('');
  });

  it('filters the output', async () => {
    const result = await run('<script>alert(1)</script>\n\nText');
    expect(result.output).not.toContain('<script');
    expect(result.output).toContain('Text');
  });

  it('applies the gfm option', async () => {
    expect((await run('a ~~b~~', { gfm: true })).output).toContain('<del>');
    expect((await run('a ~~b~~', { gfm: false })).output).not.toContain('<del>');
  });

  it('applies the headerIds option', async () => {
    expect((await run('# Title', { headerIds: true })).output).toContain('id="title"');
    expect((await run('# Title', { headerIds: false })).output).not.toContain('id=');
  });

  it('applies the breaks option', async () => {
    expect((await run('a\nb', { breaks: true })).output).toContain('<br>');
    expect((await run('a\nb', { breaks: false })).output).not.toContain('<br>');
  });

  it('reports the document statistics', async () => {
    const result = await run('# Title\n\nOne two three.');
    expect(result.stats?.words).toBe(4);
    expect(result.stats?.headings).toBe(1);
  });

  it('throws a ToolError on an oversized document', async () => {
    await expect(run('x'.repeat(MAX_INPUT_CHARS + 1))).rejects.toThrow(ToolError);
  });

  it('works when the options are omitted', async () => {
    const result = await run('# Title');
    expect(result.output).toContain('<h1');
  });
});

describe('decodeEntities', () => {
  it('reverses the escaping marked applies', () => {
    expect(decodeEntities('a &lt; b &amp; c &quot;d&quot; &#39;e&#39;')).toBe(
      'a < b & c "d" \'e\'',
    );
  });
});
