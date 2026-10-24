/**
 * The data URI panel.
 *
 * The merged `data-uri` tool takes text *and* files, which the generic
 * workbench cannot express, so the tool opts into this panel via
 * `meta.panel = 'data-uri'`.
 *
 * The panel owns the interaction (text area, file picker, mode switching) and
 * hands the payload to the tool, which does the work in the Web Worker.
 */
import type { FileRunResult, OptionValues } from '@/lib/types';
import { createDropZone, downloadBlob, validateFileSelection } from '@/lib/files';
import { escapeHtml, formatBytes } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import { applyShowWhen, clearError, readOptions, showError } from '../workbench/shared';

/** The four modes of the merged tool. */
export type PanelMode = 'text-encode' | 'text-decode' | 'image-encode' | 'image-decode';

/** What the panel sends to the tool for a given mode. */
export type PanelPayload = {
  text: string;
  files: File[];
  options: OptionValues;
};

/**
 * Build the payload for a run.
 *
 * Pure: the panel state (mode, text, files, option values) goes in, the
 * payload the tool receives comes out. Image modes send the file, the text
 * modes send the text, and "data: URI → image" accepts either.
 */
export function buildPayload(
  mode: PanelMode,
  text: string,
  files: File[],
  options: OptionValues,
): PanelPayload {
  if (mode === 'image-encode') {
    return { text: '', files: files.slice(0, 1), options: { ...options, mode } };
  }
  if (mode === 'image-decode') {
    return { text, files: files.slice(0, 1), options: { ...options, mode } };
  }
  return { text, files: [], options: { ...options, mode } };
}

/** Which input the panel shows for a mode. */
export function modeInputs(mode: PanelMode): { text: boolean; file: boolean } {
  switch (mode) {
    case 'image-encode':
      return { text: false, file: true };
    case 'image-decode':
      return { text: true, file: true };
    default:
      return { text: true, file: false };
  }
}

/** Mount the data URI panel into a `[data-data-uri-workbench]` element. */
export function mountDataUriPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'data-uri';
  const textEl = root.querySelector<HTMLTextAreaElement>('[data-input]');
  const textWrap = root.querySelector<HTMLElement>('[data-text-input]');
  const fileWrap = root.querySelector<HTMLElement>('[data-file-input]');
  const fileList = root.querySelector<HTMLUListElement>('[data-file-list]');
  const optionsRoot = root.querySelector<HTMLElement>('[data-options]') ?? root;
  const runBtn = root.querySelector<HTMLButtonElement>('[data-run]')!;
  const runLabel = root.querySelector<HTMLElement>('[data-run-label]');
  const cancelBtn = root.querySelector<HTMLButtonElement>('[data-cancel]');
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-reset]');
  const errorBox = root.querySelector<HTMLElement>('[data-error]')!;
  const progressWrap = root.querySelector<HTMLElement>('[data-progress-wrap]');
  const progressBar = root.querySelector<HTMLElement>('[data-progress-bar]');
  const progressMsg = root.querySelector<HTMLElement>('[data-progress-msg]');
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]');
  const outputHost = root.querySelector<HTMLElement>('[data-output]');
  const outputsEl = root.querySelector<HTMLUListElement>('[data-outputs]');
  const statsHost = root.querySelector<HTMLElement>('[data-stats]');
  const notesHost = root.querySelector<HTMLUListElement>('[data-notes]');

  if (!runBtn || !errorBox) return;

  let file: File | null = null;
  let controller: AbortController | null = null;
  let runGeneration = 0;

  const currentMode = (): PanelMode => {
    const raw = String(readOptions(optionsRoot).mode ?? 'text-encode');
    return raw === 'text-decode' || raw === 'image-encode' || raw === 'image-decode'
      ? raw
      : 'text-encode';
  };

  function syncMode(): void {
    const { text, file: needsFile } = modeInputs(currentMode());
    if (textWrap) textWrap.hidden = !text;
    if (fileWrap) fileWrap.hidden = !needsFile;
    if (needsFile && fileWrap) {
      const label = fileWrap.querySelector<HTMLElement>('[data-file-label]');
      if (label) {
        label.textContent =
          currentMode() === 'image-encode'
            ? 'Choose an image file'
            : 'Or drop a text file that contains the data URI';
      }
    }
  }

  function renderFileList(): void {
    if (!fileList) return;
    fileList.innerHTML = file
      ? `<li class="flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5">
          <span class="truncate">${escapeHtml(file.name)}</span>
          <span class="flex shrink-0 items-center gap-2 text-xs text-[rgb(var(--text-muted))]">
            ${formatBytes(file.size)}
            <button type="button" data-remove aria-label="Remove ${escapeHtml(file.name)}" class="hover:text-[rgb(var(--danger))]">✕</button>
          </span>
        </li>`
      : '';
  }

  const dz = createDropZone(root.querySelector<HTMLElement>('[data-drop]')!, {
    accept: '',
    multiple: false,
    onFiles: (files) => {
      const next = files[0] ?? null;
      if (next) {
        const limit = validateFileSelection([next]);
        if (limit) {
          showError(errorBox, limit);
          return;
        }
      }
      file = next;
      renderFileList();
      clearError(errorBox);
    },
  });

  fileList?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]');
    if (!button) return;
    file = null;
    renderFileList();
  });

  function renderResult(result: FileRunResult): void {
    if (outputHost) {
      outputHost.innerHTML = '';
      const report = result.report;
      if (report) {
        if (report.render === 'code') {
          const pre = document.createElement('pre');
          pre.className = 'overflow-x-auto rounded-lg border p-3 text-xs leading-relaxed';
          pre.textContent = report.output;
          outputHost.appendChild(pre);
          if (report.language) {
            const tag = document.createElement('span');
            tag.className = 'chip mt-2';
            tag.textContent = report.language;
            outputHost.appendChild(tag);
          }
        } else {
          const ta = document.createElement('textarea');
          ta.readOnly = true;
          ta.className = 'field';
          ta.setAttribute('aria-label', 'Result output');
          ta.rows = Math.min(20, Math.max(4, report.output.split('\n').length + 1));
          ta.value = report.output;
          outputHost.appendChild(ta);
        }
      }
    }

    if (outputsEl) {
      outputsEl.innerHTML = '';
      for (const output of result.outputs) {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between gap-3 rounded-lg border px-3 py-2';
        const name = document.createElement('span');
        name.className = 'truncate text-sm';
        name.textContent = `${output.filename} · ${formatBytes(output.blob.size)}`;
        const download = document.createElement('button');
        download.type = 'button';
        download.className = 'btn btn-subtle btn-sm shrink-0';
        download.textContent = 'Save';
        download.addEventListener('click', () => downloadBlob(output.blob, output.filename));
        li.append(name, download);
        outputsEl.appendChild(li);
      }
    }

    if (statsHost) {
      statsHost.innerHTML = '';
      for (const [key, value] of Object.entries(result.stats ?? {})) {
        const span = document.createElement('span');
        span.innerHTML = `<span class="font-medium text-[rgb(var(--text))]">${escapeHtml(key)}:</span> ${escapeHtml(String(value))}`;
        statsHost.appendChild(span);
      }
    }

    if (notesHost) {
      notesHost.innerHTML = '';
      for (const warning of result.warnings ?? []) {
        const li = document.createElement('li');
        li.style.color = 'rgb(var(--warning))';
        li.textContent = `⚠ ${warning}`;
        notesHost.appendChild(li);
      }
      for (const note of result.notes ?? []) {
        const li = document.createElement('li');
        li.className = 'text-[rgb(var(--text-muted))]';
        li.textContent = note;
        notesHost.appendChild(li);
      }
    }
  }

  async function run(): Promise<void> {
    const generation = ++runGeneration;
    controller?.abort();
    controller = new AbortController();
    clearError(errorBox);
    runBtn.disabled = true;
    runBtn.setAttribute('aria-busy', 'true');
    if (runLabel) runLabel.textContent = 'Working…';
    if (cancelBtn) cancelBtn.hidden = false;
    if (progressWrap) progressWrap.hidden = false;
    if (progressBar) progressBar.style.width = '0%';
    if (progressMsg) progressMsg.textContent = 'Working…';
    if (resultWrap) resultWrap.hidden = true;

    const payload = buildPayload(
      currentMode(),
      textEl?.value ?? '',
      file ? [file] : [],
      readOptions(optionsRoot),
    );

    try {
      const result = await runToolById<FileRunResult>(toolId, payload, {
        signal: controller.signal,
        onProgress: (fraction, message) => {
          if (generation !== runGeneration) return;
          const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
          if (progressBar) progressBar.style.width = `${pct}%`;
          if (progressMsg) progressMsg.textContent = message ? `${message} — ${pct}%` : `${pct}%`;
        },
      });
      if (generation !== runGeneration) return;
      if (progressBar) progressBar.style.width = '100%';
      if (progressMsg) progressMsg.textContent = 'Done';
      renderResult(result);
      if (resultWrap) resultWrap.hidden = false;
    } catch (error) {
      if (generation !== runGeneration) return;
      const err = error as Error & { hint?: string };
      if (err.name === 'AbortError') {
        if (progressMsg) progressMsg.textContent = 'Cancelled';
      } else {
        showError(errorBox, err.message || 'Something went wrong.', err.hint);
      }
    } finally {
      if (generation === runGeneration) {
        runBtn.disabled = false;
        runBtn.removeAttribute('aria-busy');
        if (runLabel) runLabel.textContent = 'Run';
        if (cancelBtn) cancelBtn.hidden = true;
        controller = null;
      }
    }
  }

  runBtn.addEventListener('click', () => void run());
  cancelBtn?.addEventListener('click', () => controller?.abort());
  resetBtn?.addEventListener('click', () => {
    runGeneration += 1;
    controller?.abort();
    controller = null;
    if (textEl) textEl.value = '';
    file = null;
    renderFileList();
    clearError(errorBox);
    if (resultWrap) resultWrap.hidden = true;
    if (progressWrap) progressWrap.hidden = true;
  });

  optionsRoot.addEventListener('change', () => {
    applyShowWhen(optionsRoot);
    syncMode();
  });
  optionsRoot.addEventListener('input', () => {
    applyShowWhen(optionsRoot);
    syncMode();
  });

  root.querySelectorAll<HTMLButtonElement>('[data-example]').forEach((btn) => {
    btn.addEventListener('click', () => {
      try {
        const payload = JSON.parse(btn.dataset.examplePayload ?? '{}') as {
          input?: string;
          options?: Record<string, unknown>;
        };
        if (textEl) textEl.value = payload.input ?? '';
        for (const [key, value] of Object.entries(payload.options ?? {})) {
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
        applyShowWhen(optionsRoot);
        syncMode();
        void run();
      } catch {
        /* malformed example */
      }
    });
  });

  applyShowWhen(optionsRoot);
  syncMode();
  renderFileList();

  window.addEventListener(
    'beforeunload',
    () => {
      controller?.abort();
      runGeneration += 1;
      dz.destroy();
    },
    { once: true },
  );
}
