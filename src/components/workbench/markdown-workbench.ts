/**
 * The Markdown preview panel.
 *
 * The panel is a split pane: a source editor on the left, a live rendering of
 * it on the right. The rendering happens in two steps:
 *
 *   1. The shared text workbench renders the document with the tool's own
 *      `marked` dialect and its sanitiser — the tool owns both the parsing
 *      rules and the filtering.
 *   2. This panel takes that HTML, replaces the code blocks with Shiki-
 *      highlighted versions and writes the result into the preview iframe.
 *
 * The preview lives in an `<iframe sandbox>` (no `allow-scripts`, no
 * `allow-same-origin`) whose document carries a strict Content-Security-
 * Policy, so raw HTML in the Markdown can neither run script nor reach this
 * page nor fetch anything from the network.
 *
 * The exported file, the copied HTML and the printed page are built from the
 * same filtered markup, so everything that leaves the sandbox is safe to open.
 */
import { copyText } from '@/lib/clipboard';
import { downloadText } from '@/lib/files';
import { slugify } from '@/lib/format';
import {
  applyCodeHighlighting,
  buildExportDocument,
  buildPreviewDocument,
  buildPrintFragment,
  extractCodeFences,
  extractTitle,
  type PreviewTheme,
} from '@/tools/developer/markdown-preview.tool';
import {
  loadHighlighter,
  normalizeLanguage,
  resolveTheme,
  type CodeHighlighter,
  type ThemeName,
} from '@/tools/developer/markdown-preview.highlight';
import { readOptions } from './shared';

/** Mount the Markdown preview panel into a `[data-markdown-workbench]` element. */
export function mountMarkdownWorkbench(root: HTMLElement): void {
  const input = root.querySelector<HTMLTextAreaElement>('[data-input]')!;
  const frame = root.querySelector<HTMLIFrameElement>('[data-preview-frame]')!;
  const outputHost = root.querySelector<HTMLElement>('[data-output]')!;
  const statusEl = root.querySelector<HTMLElement>('[data-status]')!;
  const optionsRoot = root.querySelector<HTMLElement>('[data-options]') ?? root;
  const exportBtn = root.querySelector<HTMLButtonElement>('[data-export]');
  const copyBtn = root.querySelector<HTMLButtonElement>('[data-copy-html]');
  const printBtn = root.querySelector<HTMLButtonElement>('[data-print]');
  const runBtn = root.querySelector<HTMLButtonElement>('[data-run]');
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-clear]');

  /** The highlighted HTML of the last render. */
  let lastHtml = '';
  let lastTheme: PreviewTheme = 'light';
  let generation = 0;
  let pending: ReturnType<typeof setTimeout> | undefined;

  const highlighters = new Map<ThemeName, Promise<CodeHighlighter | null>>();

  function toast(message: string): void {
    (window as unknown as { toast?: (m: string) => void }).toast?.(message);
  }

  /** Load the highlighter for a theme, once. */
  function getHighlighter(theme: ThemeName): Promise<CodeHighlighter | null> {
    const cached = highlighters.get(theme);
    if (cached) return cached;
    const promise = loadHighlighter(theme);
    highlighters.set(theme, promise);
    return promise;
  }

  /** The languages the document needs, so only those chunks are downloaded. */
  function usedLanguages(text: string): string[] {
    const out: string[] = [];
    for (const fence of extractCodeFences(text)) {
      const language = normalizeLanguage(fence.language);
      if (language && !out.includes(language)) out.push(language);
    }
    return out;
  }

  /** Load the languages the document needs, then highlight every code block. */
  async function highlightBlocks(
    html: string,
    highlighter: CodeHighlighter,
    theme: ThemeName,
  ): Promise<string> {
    for (const language of usedLanguages(input.value)) {
      await highlighter.prepare(language);
    }
    return applyCodeHighlighting(html, (code, language) => highlighter.highlight(code, language));
  }

  /** Build the preview document from the HTML the shared workbench produced. */
  async function updatePreview(html: string): Promise<void> {
    const seq = ++generation;
    const options = readOptions(optionsRoot);
    const theme: PreviewTheme = options.theme === 'dark' ? 'dark' : 'light';
    const codeTheme = resolveTheme(String(options.codeTheme ?? 'auto'), theme);

    let body = html;
    if (options.highlight !== false && usedLanguages(input.value).length > 0) {
      statusEl.textContent = 'Loading highlighter…';
      const highlighter = await getHighlighter(codeTheme);
      if (seq !== generation) return;
      if (highlighter) {
        body = await highlightBlocks(html, highlighter, codeTheme);
        if (seq !== generation) return;
      } else {
        statusEl.textContent = 'Highlighter unavailable — code blocks stay plain text.';
      }
    }

    lastHtml = body;
    lastTheme = theme;
    frame.srcdoc = buildPreviewDocument(body, theme);
    statusEl.textContent = 'Preview updated';
  }

  /**
   * The shared workbench renders the document; the panel turns that HTML into
   * the live preview. The mutation observer picks up the rendered output.
   */
  const observer = new MutationObserver(() => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = undefined;
      const textarea = outputHost.querySelector<HTMLTextAreaElement>('textarea');
      void updatePreview(textarea?.value ?? '');
    }, 0);
  });
  observer.observe(outputHost, { childList: true, subtree: true, characterData: true });

  /* ---------------------------------------------------------------------- */
  /*  Actions                                                                */
  /* ---------------------------------------------------------------------- */

  exportBtn?.addEventListener('click', () => {
    const title = extractTitle(input.value);
    const document_ = buildExportDocument({ title, body: lastHtml, theme: lastTheme });
    downloadText(document_, `${slugify(title) || 'document'}.html`, 'text/html');
    toast('HTML file downloaded');
  });

  copyBtn?.addEventListener('click', () => {
    void (async () => {
      const ok = await copyText(lastHtml);
      toast(ok ? 'HTML copied' : 'Copy failed');
    })();
  });

  printBtn?.addEventListener('click', () => {
    const printRoot = ensurePrintRoot();
    printRoot.innerHTML = buildPrintFragment(lastHtml, lastTheme);
    document.documentElement.setAttribute('data-printing', 'true');
    const cleanup = () => {
      document.documentElement.removeAttribute('data-printing');
      printRoot.innerHTML = '';
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  });

  clearBtn?.addEventListener('click', () => {
    // The shared workbench clears the field; the rendered output is dropped
    // here so the preview follows.
    outputHost.textContent = '';
    lastHtml = '';
  });

  /* ---------------------------------------------------------------------- */
  /*  Wiring                                                                 */
  /* ---------------------------------------------------------------------- */

  window.addEventListener(
    'beforeunload',
    () => {
      observer.disconnect();
      if (pending) clearTimeout(pending);
    },
    { once: true },
  );

  // The panel opens with the first example; the shared workbench only renders
  // on demand, so the first render is triggered here.
  runBtn?.click();
}

/** The print view lives directly under `<body>` so it can be printed alone. */
function ensurePrintRoot(): HTMLElement {
  const existing = document.querySelector<HTMLElement>('body > [data-print-root]');
  if (existing) return existing;
  const created = document.createElement('div');
  created.setAttribute('data-print-root', '');
  document.body.appendChild(created);
  return created;
}
