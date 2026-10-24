import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_EXPORT_NAME,
  assembleExport,
  buildDocument,
  debounce,
  exportFileName,
  mountHtmlPlaygroundPanel,
  neutraliseClosingTag,
  parseParts,
  type PlaygroundParts,
} from './html-playground-panel';
import { downloadBlob } from '@/lib/files';

const downloadBlobMock = vi.mocked(downloadBlob);

vi.mock('@/lib/files', () => ({
  downloadBlob: vi.fn(),
}));

/* -------------------------------------------------------------------------- */
/*  The document template                                                     */
/* -------------------------------------------------------------------------- */

describe('buildDocument', () => {
  const parts: PlaygroundParts = {
    html: '<h1>Title</h1>',
    css: 'h1 { color: teal; }',
    js: 'document.querySelector("h1").style.color = "red";',
  };

  it('places each part in the right tag', () => {
    const doc = buildDocument(parts);
    expect(doc).toContain('<body>\n<h1>Title</h1>');
    expect(doc).toContain('<style>\nh1 { color: teal; }\n</style>');
    expect(doc).toContain('<script>\ndocument.querySelector("h1").style.color = "red";\n</script>');
    // The template itself is whole.
    expect(doc).toMatch(/<!DOCTYPE html>/);
    expect(doc.endsWith('</html>')).toBe(true);
  });

  it('neutralises a closing script tag inside user JS', () => {
    const doc = buildDocument({
      html: '',
      css: '',
      js: 'const s = "</script><script>alert(1)</script>"',
    });
    // The user's closing tags must not be present as raw HTML.
    expect(doc).not.toContain('</script><script>');
    // The neutralised form is still present.
    expect(doc).toContain('<\\/script><script>alert(1)<\\/script>');
  });

  it('neutralises a closing style tag inside user CSS', () => {
    const doc = buildDocument({ html: '', css: 'a::after{content:"</style>"}', js: '' });
    expect(doc).not.toContain('</style></style>');
    expect(doc).toContain('<\\/style>');
  });

  it('handles empty parts without error', () => {
    const doc = buildDocument({ html: '', css: '', js: '' });
    expect(doc).toContain('<style>\n\n</style>');
    expect(doc).toContain('<script>\n\n</script>');
  });
});

describe('neutraliseClosingTag', () => {
  it('rewrites the opening angle bracket of the closing tag', () => {
    expect(neutraliseClosingTag('a </script> b', 'script')).toBe('a <\\/script> b');
  });

  it('is case-insensitive', () => {
    expect(neutraliseClosingTag('</SCRIPT>', 'script')).toBe('<\\/SCRIPT>');
  });

  it('leaves an unrelated string alone', () => {
    expect(neutraliseClosingTag('</div>', 'script')).toBe('</div>');
  });
});

describe('parseParts', () => {
  it('parses a JSON payload of the three parts', () => {
    expect(parseParts('{"html":"<p>","css":"p{}","js":"1;"}')).toEqual({
      html: '<p>',
      css: 'p{}',
      js: '1;',
    });
  });

  it('defaults missing fields to empty strings', () => {
    expect(parseParts('{"html":"<p>"}')).toEqual({ html: '<p>', css: '', js: '' });
  });

  it('returns null for non-object input', () => {
    expect(parseParts('not json')).toBeNull();
    expect(parseParts('[1,2]')).toBeNull();
    expect(parseParts('""')).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/*  The download                                                              */
/* -------------------------------------------------------------------------- */

describe('assembleExport', () => {
  it('is a text/html blob of the same document that is previewed', async () => {
    const parts = { html: '<h1>Hi</h1>', css: 'h1{color:red}', js: '1;' };
    const blob = assembleExport(parts, { fileName: 'demo' });
    expect(blob.type).toBe('text/html;charset=utf-8');
    await expect(blob.text()).resolves.toBe(buildDocument(parts));
  });

  it('is self-contained — no external references', async () => {
    const blob = assembleExport({ html: '<p>a</p>', css: 'p{}', js: '' });
    const text = await blob.text();
    expect(text).not.toMatch(/<link\b/);
    expect(text).not.toMatch(/src="http/i);
    expect(text).not.toMatch(/@import\b/);
  });
});

describe('exportFileName', () => {
  it('defaults to playground.html', () => {
    expect(exportFileName()).toBe(DEFAULT_EXPORT_NAME);
    expect(exportFileName({})).toBe(DEFAULT_EXPORT_NAME);
  });

  it('appends .html when missing', () => {
    expect(exportFileName({ fileName: 'demo' })).toBe('demo.html');
  });

  it('keeps an explicit .html name', () => {
    expect(exportFileName({ fileName: 'page.html' })).toBe('page.html');
  });
});

/* -------------------------------------------------------------------------- */
/*  Scheduling                                                                */
/* -------------------------------------------------------------------------- */

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('collapses a burst of calls into one', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d.schedule();
    d.schedule();
    d.schedule();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('lets the last scheduled call win', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d.schedule(1);
    d.schedule(2);
    vi.advanceTimersByTime(50);
    d.schedule(3);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });

  it('cancel drops a pending call', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d.schedule();
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/*  Mount                                                                     */
/* -------------------------------------------------------------------------- */

function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.htmlPlaygroundWorkbench = '';
  root.dataset.toolId = 'html-playground';
  root.innerHTML = `
    <button type="button" data-example="0" data-example-payload='{"input":"{\\"html\\":\\"<i>Ex</i>\\",\\"css\\":\\"i{}\\",\\"js\\":\\"1;\\"}"}'></button>
    <div data-options>
      <input data-opt-key="fileName" data-opt-type="text" value="demo" />
    </div>
    <textarea data-pane="html"></textarea>
    <textarea data-pane="css"></textarea>
    <textarea data-pane="js"></textarea>
    <iframe data-preview></iframe>
    <button type="button" data-download>Download</button>
    <button type="button" data-reset>Reset</button>
    <div data-error hidden></div>
  `;
  document.body.append(root);
  return root;
}

describe('mountHtmlPlaygroundPanel', () => {
  beforeEach(() => {
    downloadBlobMock.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
    document.body.innerHTML = '';
  });

  it('renders an initial preview', () => {
    const root = fixture();
    mountHtmlPlaygroundPanel(root);
    const preview = root.querySelector<HTMLIFrameElement>('[data-preview]')!;
    expect(preview.srcdoc).toContain('<body>');
    expect(preview.srcdoc).toContain('</html>');
  });

  it('re-renders the preview after a debounced edit', () => {
    vi.useFakeTimers();
    const root = fixture();
    mountHtmlPlaygroundPanel(root);
    const html = root.querySelector<HTMLTextAreaElement>('[data-pane="html"]')!;
    html.value = '<strong>New</strong>';
    html.dispatchEvent(new Event('input', { bubbles: true }));
    const preview = root.querySelector<HTMLIFrameElement>('[data-preview]')!;
    // Not before the debounce window.
    expect(preview.srcdoc).not.toContain('<strong>New</strong>');
    vi.advanceTimersByTime(250);
    expect(preview.srcdoc).toContain('<strong>New</strong>');
  });

  it('downloads the stitched file with the option file name', async () => {
    const root = fixture();
    mountHtmlPlaygroundPanel(root);
    const html = root.querySelector<HTMLTextAreaElement>('[data-pane="html"]')!;
    html.value = '<h1>Export</h1>';
    root.querySelector<HTMLButtonElement>('[data-download]')!.click();
    expect(downloadBlobMock).toHaveBeenCalledTimes(1);
    const [blob, name] = downloadBlobMock.mock.calls[0]!;
    expect(name).toBe('demo.html');
    await expect((blob as Blob).text()).resolves.toContain('<h1>Export</h1>');
  });

  it('reset restores the starter document and refreshes the preview', () => {
    const root = fixture();
    mountHtmlPlaygroundPanel(root);
    const html = root.querySelector<HTMLTextAreaElement>('[data-pane="html"]')!;
    html.value = 'changed';
    root.querySelector<HTMLButtonElement>('[data-reset]')!.click();
    expect(html.value).toContain('Hello, world!');
    expect(root.querySelector<HTMLIFrameElement>('[data-preview]')!.srcdoc).toContain(
      'Hello, world!',
    );
  });

  it('an example chip loads its parts into the panes', () => {
    const root = fixture();
    mountHtmlPlaygroundPanel(root);
    root.querySelector<HTMLButtonElement>('[data-example="0"]')!.click();
    expect(root.querySelector<HTMLTextAreaElement>('[data-pane="html"]')!.value).toBe('<i>Ex</i>');
    expect(root.querySelector<HTMLTextAreaElement>('[data-pane="css"]')!.value).toBe('i{}');
    expect(root.querySelector<HTMLTextAreaElement>('[data-pane="js"]')!.value).toBe('1;');
  });
});
