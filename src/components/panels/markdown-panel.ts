/**
 * The Markdown preview panel.
 *
 * The panel is a split pane: a source editor on the left, a live rendering of
 * it on the right. The rendering happens in three steps:
 *
 *   1. The tool's own `run()` parses the document with the tool's `marked`
 *      dialect and filters the result — the tool owns both the parsing rules
 *      and the sanitiser.
 *   2. This panel replaces the code blocks in that HTML with Shiki-highlighted
 *      versions, loading only the languages and the theme the document needs.
 *   3. The result is written into the preview iframe.
 *
 * The preview lives in an `<iframe sandbox>` (no `allow-scripts`, no
 * `allow-same-origin`) whose document carries a strict Content-Security-
 * Policy, so raw HTML in the Markdown can neither run script nor reach this
 * page nor fetch anything from the network.
 *
 * The exported file, the copied HTML and the printed page are built from the
 * same filtered markup, so everything that leaves the sandbox is safe to open.
 */
import { runToolById } from '@/lib/worker/client';
import { copyText } from '@/lib/clipboard';
import { downloadText } from '@/lib/files';
import { formatDuration, formatNumber, slugify } from '@/lib/format';
import type { TextRunResult } from '@/lib/types';
import {
  applyShowWhen,
  bindRangeOutputs,
  clearError,
  readOptions,
  resetOptions,
  showError,
  snapshotOptions,
} from '../workbench/shared';
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

const DEBOUNCE = 180;
/** Above this size, typing no longer triggers the debounced auto-run. */
const AUTO_RUN_CHAR_LIMIT = 100_000;

/** Mount the Markdown preview panel into a `[data-markdown-workbench]` element. */
export function mountMarkdownPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'markdown-preview';
  const input = root.querySelector<HTMLTextAreaElement>('[data-input]');
  const frame = root.querySelector<HTMLIFrameElement>('[data-preview-frame]');
  const outputHost = root.querySelector<HTMLElement>('[data-output]');
  const statusEl = root.querySelector<HTMLElement>('[data-status]');
  const errorBox = root.querySelector<HTMLElement>('[data-error]');
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]');
  const statsHost = root.querySelector<HTMLElement>('[data-stats]');
  const notesHost = root.querySelector<HTMLUListElement>('[data-notes]');
  const timing = root.querySelector<HTMLElement>('[data-timing]');
  const inputStats = root.querySelector<HTMLElement>('[data-input-stats]');
  const optionsRoot = root.querySelector<HTMLElement>('[data-options]') ?? root;
  const runBtn = root.querySelector<HTMLButtonElement>('[data-run]');
  const runLabel = root.querySelector<HTMLElement>('[data-run-label]');
  const liveBox = root.querySelector<HTMLInputElement>('[data-live]');
  const exportBtn = root.querySelector<HTMLButtonElement>('[data-export]');
  const copyBtn = root.querySelector<HTMLButtonElement>('[data-copy-html]');
  const printBtn = root.querySelector<HTMLButtonElement>('[data-print]');
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-clear]');

  if (!input || !frame) return;

  /** The filtered, highlighted HTML of the last render. */
  let lastHtml = '';
  let lastTheme: PreviewTheme = 'light';
  let controller: AbortController | null = null;
  let runSeq = 0;
  let previewSeq = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const highlighters = new Map<ThemeName, Promise<CodeHighlighter | null>>();

  function toast(message: string): void {
    (window as unknown as { toast?: (m: string) => void }).toast?.(message);
  }

  function updateInputStats(): void {
    if (!inputStats) return;
    const v = input!.value;
    inputStats.textContent = v
      ? `${formatNumber(v.length)} chars · ${formatNumber(v.split(/\n/).length)} lines`
      : '';
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
    _theme: ThemeName,
  ): Promise<string> {
    for (const language of usedLanguages(input!.value)) {
      await highlighter.prepare(language);
    }
    return applyCodeHighlighting(html, (code, language) => highlighter.highlight(code, language));
  }

  /** Turn the sanitised HTML the tool produced into the live preview. */
  async function updatePreview(html: string): Promise<void> {
    const seq = ++previewSeq;
    const options = readOptions(optionsRoot);
    const theme: PreviewTheme = options.theme === 'dark' ? 'dark' : 'light';
    const codeTheme = resolveTheme(String(options.codeTheme ?? 'auto'), theme);

    let body = html;
    if (options.highlight !== false && usedLanguages(input!.value).length > 0) {
      if (statusEl) statusEl.textContent = 'Loading highlighter…';
      const highlighter = await getHighlighter(codeTheme);
      if (seq !== previewSeq) return;
      if (highlighter) {
        body = await highlightBlocks(html, highlighter, codeTheme);
        if (seq !== previewSeq) return;
      } else if (statusEl) {
        statusEl.textContent = 'Highlighter unavailable — code blocks stay plain text.';
      }
    }

    lastHtml = body;
    lastTheme = theme;
    frame!.srcdoc = buildPreviewDocument(body, theme);
    if (statusEl) statusEl.textContent = 'Preview updated';
  }

  function renderHtmlSource(html: string): void {
    if (!outputHost) return;
    outputHost.innerHTML = '';
    const pre = document.createElement('pre');
    pre.className = 'overflow-x-auto rounded-lg border p-3 text-xs leading-relaxed';
    pre.textContent = html;
    outputHost.appendChild(pre);
  }

  async function run(): Promise<void> {
    const seq = ++runSeq;
    controller?.abort();
    controller = new AbortController();
    if (errorBox) clearError(errorBox);
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.setAttribute('aria-busy', 'true');
    }
    if (runLabel) runLabel.textContent = 'Rendering…';
    if (timing) timing.textContent = '';
    updateInputStats();
    const started = performance.now();
    try {
      const result = await runToolById<TextRunResult>(
        toolId,
        { text: input!.value, options: readOptions(optionsRoot) },
        {
          signal: controller.signal,
          onProgress: (_fraction, message) => {
            if (seq === runSeq && message && timing) timing.textContent = message;
          },
        },
      );
      if (seq !== runSeq) return;
      renderHtmlSource(result.output);
      if (resultWrap) resultWrap.hidden = false;

      if (statsHost) {
        statsHost.innerHTML = '';
        for (const [k, v] of Object.entries(result.stats ?? {})) {
          const s = document.createElement('span');
          s.innerHTML = `<span class="font-medium text-[rgb(var(--text))]">${k}:</span> ${v}`;
          statsHost.appendChild(s);
        }
      }
      if (notesHost) {
        notesHost.innerHTML = '';
        for (const w of result.warnings ?? []) {
          const li = document.createElement('li');
          li.style.color = 'rgb(var(--warning))';
          li.textContent = `⚠ ${w}`;
          notesHost.appendChild(li);
        }
        for (const n of result.notes ?? []) {
          const li = document.createElement('li');
          li.className = 'text-[rgb(var(--text-muted))]';
          li.textContent = n;
          notesHost.appendChild(li);
        }
      }
      await updatePreview(result.output);
      if (seq === runSeq && timing)
        timing.textContent = formatDuration(performance.now() - started);
    } catch (err) {
      if (seq !== runSeq) return;
      const e = err as Error & { hint?: string };
      if (e.name === 'AbortError') return;
      if (resultWrap) resultWrap.hidden = true;
      if (timing) timing.textContent = '';
      if (errorBox) showError(errorBox, e.message || 'Something went wrong.', e.hint);
    } finally {
      if (seq === runSeq && runBtn) {
        runBtn.disabled = false;
        runBtn.removeAttribute('aria-busy');
        if (runLabel) runLabel.textContent = 'Render preview';
      }
    }
  }

  function schedule(): void {
    if (!liveBox?.checked) return;
    // Very large documents: skip the debounced auto-run (it would re-render on
    // every keystroke). Manual Run always works.
    if ((input?.value.length ?? 0) > AUTO_RUN_CHAR_LIMIT) {
      clearTimeout(timer);
      timer = undefined;
      if (inputStats) {
        inputStats.textContent = 'Large document — live preview paused. Press Run to render it.';
      }
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => void run(), DEBOUNCE);
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

  /* ---------------------------------------------------------------------- */
  /*  Wiring                                                                */
  /* ---------------------------------------------------------------------- */

  bindRangeOutputs(root);
  snapshotOptions(optionsRoot);
  applyShowWhen(optionsRoot);

  runBtn?.addEventListener('click', () => void run());

  input.addEventListener('input', () => {
    updateInputStats();
    schedule();
  });
  optionsRoot.addEventListener('input', () => {
    applyShowWhen(optionsRoot);
    schedule();
  });
  optionsRoot.addEventListener('change', () => {
    applyShowWhen(optionsRoot);
    schedule();
  });

  clearBtn?.addEventListener('click', () => {
    input.value = '';
    updateInputStats();
    if (resultWrap) resultWrap.hidden = true;
    if (outputHost) outputHost.innerHTML = '';
    if (statusEl) statusEl.textContent = '';
    if (errorBox) clearError(errorBox);
    lastHtml = '';
  });

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

  root.querySelectorAll<HTMLButtonElement>('[data-example]').forEach((btn) => {
    btn.addEventListener('click', () => {
      try {
        const payload = JSON.parse(btn.dataset.examplePayload ?? '{}') as {
          input?: string;
          options?: Record<string, unknown>;
        };
        input.value = payload.input ?? '';
        // An example only carries what it changes; reset the rest to defaults.
        resetOptions(optionsRoot);
        for (const [k, v] of Object.entries(payload.options ?? {})) {
          const el = optionsRoot.querySelector<HTMLInputElement | HTMLSelectElement>(
            `[data-opt-key="${k}"]`,
          );
          if (!el) continue;
          if ((el as HTMLInputElement).type === 'checkbox')
            (el as HTMLInputElement).checked = Boolean(v);
          else el.value = String(v);
        }
        applyShowWhen(optionsRoot);
        updateInputStats();
        void run();
      } catch {
        /* malformed example payload */
      }
    });
  });

  updateInputStats();
  // The panel opens with the first example, so render it once.
  if (input.value) void run();
}
