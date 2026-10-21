/**
 * The Markdown preview panel.
 *
 * A source editor on the left, a live rendering of it on the right. The
 * rendering happens in two steps:
 *
 *   1. `runToolById('markdown-preview', …)` renders the Markdown with the
 *      shared `marked` dialect and filters the result — the tool owns both the
 *      parsing rules and the sanitiser.
 *   2. The code blocks in the result are replaced by Shiki-highlighted
 *      versions. Shiki is loaded lazily, one chunk per language and theme,
 *      and only when a document actually contains code.
 *
 * The result is written into an `<iframe sandbox>` (no `allow-scripts`, no
 * `allow-same-origin`) whose document carries a strict Content-Security-
 * Policy, so raw HTML in the Markdown can neither run script nor reach this
 * page nor fetch anything from the network.
 *
 * The exported file, the copied HTML and the printed page are built from the
 * same filtered markup, so everything that leaves the sandbox is safe to open.
 */
import type { TextRunResult } from '@/lib/types';
import { copyText } from '@/lib/clipboard';
import { downloadText } from '@/lib/files';
import { formatNumber, slugify } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import {
  buildExportDocument,
  buildPreviewDocument,
  buildPrintFragment,
  documentStats,
  extractCodeBlocks,
  extractCodeFences,
  extractTitle,
  plainCodeBlock,
  replaceCodeBlocks,
  type PreviewTheme,
} from '@/tools/developer/markdown-preview.tool';
import {
  loadHighlighter,
  normalizeLanguage,
  resolveTheme,
  type CodeHighlighter,
  type ThemeName,
} from '@/tools/developer/markdown-preview.highlight';
import { clearError, readOptions, showError } from './shared';

/** How long the panel waits after the last keystroke before it re-renders. */
const DEBOUNCE = 180;
/** Above this size the live preview stops updating while the user types. */
const LIVE_LIMIT = 50_000;

/** Mount the Markdown preview panel into a `[data-markdown-workbench]` element. */
export function mountMarkdownWorkbench(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'markdown-preview';
  const input = root.querySelector<HTMLTextAreaElement>('[data-input]')!;
  const frame = root.querySelector<HTMLIFrameElement>('[data-preview-frame]')!;
  const statusEl = root.querySelector<HTMLElement>('[data-status]')!;
  const statsEl = root.querySelector<HTMLElement>('[data-stats]')!;
  const inputStats = root.querySelector<HTMLElement>('[data-input-stats]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-error]')!;
  const optionsRoot = root.querySelector<HTMLElement>('[data-options]') ?? root;
  const exportBtn = root.querySelector<HTMLButtonElement>('[data-export]');
  const copyBtn = root.querySelector<HTMLButtonElement>('[data-copy]');
  const printBtn = root.querySelector<HTMLButtonElement>('[data-print]');
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-clear]');

  if (!input || !frame) return;

  /** The HTML of the last successful render (already filtered and highlighted). */
  let lastHtml = '';
  let lastTheme: PreviewTheme = 'light';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;

  const highlighters = new Map<ThemeName, Promise<CodeHighlighter | null>>();
  const failedThemes = new Set<ThemeName>();

  function setStatus(text: string): void {
    if (statusEl) statusEl.textContent = text;
  }

  function toast(message: string): void {
    (window as unknown as { toast?: (m: string) => void }).toast?.(message);
  }

  function updateInputStats(): void {
    if (!inputStats) return;
    const value = input.value;
    inputStats.textContent = value
      ? `${formatNumber(value.length)} chars · ${formatNumber(value.split('\n').length)} lines`
      : '';
  }

  /** Load the highlighter for a theme, once. */
  function getHighlighter(theme: ThemeName): Promise<CodeHighlighter | null> {
    const cached = highlighters.get(theme);
    if (cached) return cached;
    setStatus('Loading highlighter…');
    const promise = loadHighlighter(theme).then((highlighter) => {
      if (!highlighter) failedThemes.add(theme);
      return highlighter;
    });
    highlighters.set(theme, promise);
    return promise;
  }

  /** Replace every code block with its highlighted version. */
  async function highlightBlocks(
    html: string,
    highlighter: CodeHighlighter,
  ): Promise<string> {
    const blocks = extractCodeBlocks(html);
    const highlighted = await Promise.all(
      blocks.map((block) => highlighter.highlight(block.code, block.language)),
    );
    let index = 0;
    return replaceCodeBlocks(html, (block) => {
      const out = highlighted[index];
      index += 1;
      return out ?? plainCodeBlock(block);
    });
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

  async function render(): Promise<void> {
    const seq = ++generation;
    const text = input.value;
    const options = readOptions(optionsRoot);
    const gfm = options.gfm !== false;
    const breaks = options.breaks === true;
    const headerIds = options.headerIds !== false;
    const highlight = options.highlight !== false;
    const theme: PreviewTheme = options.theme === 'dark' ? 'dark' : 'light';
    const codeTheme = resolveTheme(String(options.codeTheme ?? 'auto'), theme);
    const started = performance.now();

    try {
      const result = await runToolById<TextRunResult>(
        toolId,
        { text, options: { gfm, breaks, headerIds, highlight, theme, codeTheme } },
        {},
      );
      if (seq !== generation) return;

      // The tool already filtered the markup; only the code blocks are replaced
      // here, with markup the highlighter generated itself.
      let html = result.output;
      if (highlight && usedLanguages(text).length > 0) {
        const highlighter = await getHighlighter(codeTheme);
        if (seq !== generation) return;
        if (highlighter) {
          html = await highlightBlocks(html, highlighter);
          if (seq !== generation) return;
        }
      }

      lastHtml = html;
      lastTheme = theme;
      frame.srcdoc = buildPreviewDocument(html, theme);
      clearError(errorBox);

      if (highlight && failedThemes.has(codeTheme)) {
        setStatus('Highlighter unavailable — code shown as plain text');
      } else {
        setStatus('Preview updated');
      }
      if (statsEl) {
        const stats = documentStats(text);
        statsEl.textContent = `${formatNumber(stats.characters)} chars · ${formatNumber(
          stats.words,
        )} words · ${formatNumber(stats.headings)} headings · ${formatNumber(
          stats.codeBlocks,
        )} code blocks · ${Math.round(performance.now() - started)} ms`;
      }
    } catch (error) {
      if (seq !== generation) return;
      const err = error as Error & { hint?: string };
      if (err.name === 'AbortError') return;
      showError(errorBox, err.message || 'The preview could not be rendered.', err.hint);
    }
  }

  function schedule(): void {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (input.value.length > LIVE_LIMIT) {
      if (inputStats) {
        inputStats.textContent =
          'Large document — the live preview is paused. Make an edit to update it.';
      }
      return;
    }
    timer = setTimeout(() => {
      void render();
    }, DEBOUNCE);
  }

  async function renderNow(): Promise<void> {
    if (timer) clearTimeout(timer);
    timer = undefined;
    await render();
  }

  /* ---------------------------------------------------------------------- */
  /*  Actions                                                                */
  /* ---------------------------------------------------------------------- */

  exportBtn?.addEventListener('click', () => {
    void (async () => {
      try {
        await renderNow();
        const title = extractTitle(input.value);
        const document_ = buildExportDocument({ title, body: lastHtml, theme: lastTheme });
        downloadText(document_, `${slugify(title) || 'document'}.html`, 'text/html');
        toast('HTML file downloaded');
      } catch (error) {
        showError(errorBox, (error as Error).message || 'The export failed.');
      }
    })();
  });

  copyBtn?.addEventListener('click', () => {
    void (async () => {
      const ok = await copyText(lastHtml);
      toast(ok ? 'HTML copied' : 'Copy failed');
    })();
  });

  printBtn?.addEventListener('click', () => {
    void (async () => {
      try {
        await renderNow();
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
      } catch (error) {
        showError(errorBox, (error as Error).message || 'The print view could not be built.');
      }
    })();
  });

  clearBtn?.addEventListener('click', () => {
    input.value = '';
    lastHtml = '';
    frame.srcdoc = buildPreviewDocument('', lastTheme);
    updateInputStats();
    clearError(errorBox);
    setStatus('Preview updated');
  });

  /* ---------------------------------------------------------------------- */
  /*  Wiring                                                                 */
  /* ---------------------------------------------------------------------- */

  input.addEventListener('input', () => {
    updateInputStats();
    schedule();
  });

  optionsRoot.addEventListener('input', () => {
    schedule();
  });
  optionsRoot.addEventListener('change', () => {
    schedule();
  });

  root.querySelectorAll<HTMLButtonElement>('[data-example]').forEach((btn) => {
    btn.addEventListener('click', () => {
      try {
        const payload = JSON.parse(btn.dataset.examplePayload!) as {
          input: string;
          options: Record<string, unknown>;
        };
        input.value = payload.input;
        for (const [key, value] of Object.entries(payload.options)) {
          const el = optionsRoot.querySelector<HTMLInputElement | HTMLSelectElement>(
            `[data-opt-key="${key}"]`,
          );
          if (!el) continue;
          if ((el as HTMLInputElement).type === 'checkbox') {
            (el as HTMLInputElement).checked = Boolean(value);
          } else {
            el.value = String(value);
          }
        }
        updateInputStats();
        void renderNow();
      } catch {
        /* malformed example */
      }
    });
  });

  window.addEventListener(
    'beforeunload',
    () => {
      if (timer) clearTimeout(timer);
    },
    { once: true },
  );

  updateInputStats();
  void render();
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
