/**
 * The SQLite viewer panel.
 *
 * Owns the whole screen flow: drop a `.db` / `.sqlite` file, see its tables and
 * the file summary, click a table to browse its rows, dump the schema, or run a
 * read-only statement and export the result as CSV or JSON. The database work —
 * sql.js opening the file and answering the request — happens in the tool's Web
 * Worker (`sqlite-viewer.tool.ts`), so a large database never freezes the tab.
 * The pure helpers at the top of this file are the panel's side of that
 * contract; the DOM mount at the bottom only wires them to the page.
 *
 * The rules that decide whether a statement may run and how a result is
 * serialised live in `sqlite-viewer.core.ts`, shared with the worker, so the
 * panel and the tool can never disagree about what is allowed.
 */
import type { ExportFormat, ViewerAction } from '@/tools/developer/sqlite-viewer.core';
import { quoteIdent } from '@/tools/developer/sqlite-viewer.core';
import type { FileRunResult, OptionValues } from '@/lib/types';
import { createDropZone, downloadBlob, validateFileSelection } from '@/lib/files';
import { escapeHtml, formatBytes } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import { clearError, showError } from '../workbench/shared';

/** A bounded `SELECT` for browsing one table. */
export function browseSql(table: string, maxRows: number): string {
  return `SELECT * FROM ${quoteIdent(table)} LIMIT ${Math.max(1, Math.floor(maxRows))};`;
}

/** One request as the panel states it. */
export interface PanelRequest {
  action: ViewerAction;
  query?: string;
  table?: string;
  exportFormat?: ExportFormat;
  maxRows?: number;
}

/** The option values the tool receives for a request. */
export function optionValuesFor(request: PanelRequest): OptionValues {
  return {
    action: request.action,
    query: request.query ?? '',
    table: request.table ?? '',
    export: request.exportFormat ?? 'none',
    maxRows: request.maxRows ?? 500,
  };
}

/* -------------------------------------------------------------------------- */
/*  Panel                                                                      */
/* -------------------------------------------------------------------------- */

/** Mount the SQLite viewer panel into a `[data-file-workbench]` element. */
export function mountSqliteViewerPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'sqlite-viewer';
  const dropEl = root.querySelector<HTMLElement>('[data-drop]')!;
  const listEl = root.querySelector<HTMLUListElement>('[data-file-list]')!;
  const tablesEl = root.querySelector<HTMLUListElement>('[data-tables]')!;
  const queryEl = root.querySelector<HTMLTextAreaElement>('[data-query]')!;
  const exportEl = root.querySelector<HTMLSelectElement>('[data-export]')!;
  const maxRowsEl = root.querySelector<HTMLInputElement>('[data-max-rows]')!;
  const runBtn = root.querySelector<HTMLButtonElement>('[data-run]')!;
  const runLabel = root.querySelector<HTMLElement>('[data-run-label]')!;
  const cancelBtn = root.querySelector<HTMLButtonElement>('[data-cancel]')!;
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-reset]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-error]')!;
  const progressWrap = root.querySelector<HTMLElement>('[data-progress-wrap]')!;
  const progressBar = root.querySelector<HTMLElement>('[data-progress-bar]')!;
  const progressMsg = root.querySelector<HTMLElement>('[data-progress-msg]')!;
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]')!;
  const outputHost = root.querySelector<HTMLElement>('[data-output]')!;
  const outputsEl = root.querySelector<HTMLUListElement>('[data-outputs]')!;
  const statsHost = root.querySelector<HTMLElement>('[data-stats]')!;
  const notesEl = root.querySelector<HTMLUListElement>('[data-notes]')!;

  if (
    !dropEl ||
    !listEl ||
    !tablesEl ||
    !queryEl ||
    !exportEl ||
    !maxRowsEl ||
    !runBtn ||
    !runLabel ||
    !cancelBtn ||
    !resetBtn ||
    !errorBox ||
    !progressWrap ||
    !progressBar ||
    !progressMsg ||
    !resultWrap ||
    !outputHost ||
    !outputsEl ||
    !statsHost ||
    !notesEl
  ) {
    return;
  }

  let file: File | null = null;
  let controller: AbortController | null = null;
  let runGeneration = 0;

  const rowLimit = (): number => Math.max(1, Math.floor(Number(maxRowsEl.value) || 500));

  /** Show only what makes sense before a file is chosen. */
  function syncControls(): void {
    runBtn.disabled = !file;
    tablesEl.hidden = !file;
  }

  function renderFileList(): void {
    listEl.innerHTML = file
      ? `<li class="flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5">
          <span class="truncate">${escapeHtml(file.name)}</span>
          <span class="flex shrink-0 items-center gap-2 text-xs text-[rgb(var(--text-muted))]">
            ${formatBytes(file.size)}
            <button type="button" data-remove aria-label="Remove ${escapeHtml(file.name)}" class="hover:text-[rgb(var(--danger))]">✕</button>
          </span>
        </li>`
      : '';
  }

  /* ---------------------------------------------------------------------- */
  /*  Rendering                                                             */
  /* ---------------------------------------------------------------------- */

  /** The table list pane, built from a `browse` result. */
  function renderTables(result: FileRunResult): void {
    tablesEl.innerHTML = '';
    const report = result.report;
    if (report?.render !== 'table') return;
    let data: { headers: string[]; rows: string[][] };
    try {
      data = JSON.parse(report.output);
    } catch {
      return;
    }
    const nameColumn = data.headers.indexOf('Table');
    if (nameColumn < 0) return;

    for (const row of data.rows) {
      const name = row[nameColumn] ?? '';
      if (!name) continue;
      const li = document.createElement('li');
      li.className =
        'flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2';

      const browse = document.createElement('button');
      browse.type = 'button';
      browse.className = 'text-left text-sm font-medium text-[rgb(var(--accent))] hover:underline';
      browse.textContent = name;
      browse.addEventListener('click', () => {
        // Show the statement in the editor, then run exactly that — with the
        // export choice the user has already made.
        const sql = browseSql(name, rowLimit());
        const format =
          exportEl.value === 'csv' || exportEl.value === 'json' ? exportEl.value : 'none';
        queryEl.value = sql;
        void run({ action: 'query', query: sql, exportFormat: format });
      });

      const meta = document.createElement('span');
      meta.className = 'flex shrink-0 items-center gap-2 text-xs text-[rgb(var(--text-muted))]';
      meta.textContent = `${row[1] ?? ''} · ${row[2] ?? '0'} columns · ${row[3] ?? '—'} rows`;

      const schema = document.createElement('button');
      schema.type = 'button';
      schema.className = 'btn btn-ghost !px-2 !py-1 text-xs';
      schema.textContent = 'Schema';
      schema.addEventListener('click', () => void run({ action: 'schema', table: name }));

      li.append(browse, meta, schema);
      tablesEl.appendChild(li);
    }
  }

  function renderOutput(result: FileRunResult): void {
    outputHost.innerHTML = '';
    const report = result.report;
    if (!report) return;

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
      return;
    }

    if (report.render !== 'table') {
      const ta = document.createElement('textarea');
      ta.readOnly = true;
      ta.className = 'field';
      ta.setAttribute('aria-label', 'Result output');
      ta.rows = Math.min(20, Math.max(4, report.output.split('\n').length + 1));
      ta.value = report.output;
      outputHost.appendChild(ta);
      return;
    }

    let data: { headers: string[]; rows: string[][] } = { headers: [], rows: [] };
    try {
      data = JSON.parse(report.output);
    } catch {
      /* fall through to an empty table */
    }
    const wrap = document.createElement('div');
    wrap.className = 'overflow-x-auto rounded-lg border';
    const table = document.createElement('table');
    table.className = 'w-full text-left text-sm';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>${data.headers
      .map(
        (h) =>
          `<th scope="col" class="border-b bg-[rgb(var(--bg-subtle))] px-3 py-2 text-left font-semibold text-[rgb(var(--text))]">${escapeHtml(h)}</th>`,
      )
      .join('')}</tr>`;
    const tbody = document.createElement('tbody');
    tbody.innerHTML = data.rows
      .map(
        (r) =>
          `<tr>${r.map((c) => `<td class="border-b px-3 py-1.5 align-top font-mono text-xs text-[rgb(var(--text))]">${escapeHtml(String(c))}</td>`).join('')}</tr>`,
      )
      .join('');
    table.append(thead, tbody);
    wrap.appendChild(table);
    outputHost.appendChild(wrap);
  }

  function renderOutputs(result: FileRunResult): void {
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
    outputsEl.hidden = result.outputs.length === 0;
  }

  function renderStats(result: FileRunResult): void {
    statsHost.innerHTML = '';
    for (const [key, value] of Object.entries(result.stats ?? {})) {
      const span = document.createElement('span');
      span.innerHTML = `<span class="font-medium text-[rgb(var(--text))]">${escapeHtml(key)}:</span> ${escapeHtml(String(value))}`;
      statsHost.appendChild(span);
    }
  }

  function renderNotes(result: FileRunResult): void {
    notesEl.innerHTML = '';
    for (const warning of result.warnings ?? []) {
      const li = document.createElement('li');
      li.style.color = 'rgb(var(--warning))';
      li.textContent = `⚠ ${warning}`;
      notesEl.appendChild(li);
    }
    for (const note of result.notes ?? []) {
      const li = document.createElement('li');
      li.className = 'text-[rgb(var(--text-muted))]';
      li.textContent = note;
      notesEl.appendChild(li);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Running                                                               */
  /* ---------------------------------------------------------------------- */

  async function run(request: PanelRequest): Promise<void> {
    if (!file) {
      showError(errorBox, 'Choose a SQLite database file first.');
      return;
    }
    const generation = ++runGeneration;
    controller?.abort();
    controller = new AbortController();
    clearError(errorBox);
    runBtn.disabled = true;
    runBtn.setAttribute('aria-busy', 'true');
    runLabel.textContent = 'Working…';
    cancelBtn.hidden = false;
    progressWrap.hidden = false;
    progressBar.style.width = '0%';
    progressMsg.textContent = 'Working…';
    resultWrap.hidden = true;

    const options = optionValuesFor({ ...request, maxRows: request.maxRows ?? rowLimit() });
    const browsing = request.action === 'browse';

    try {
      const result = await runToolById<FileRunResult>(
        toolId,
        { files: [file], options },
        {
          signal: controller.signal,
          onProgress: (fraction, message) => {
            if (generation !== runGeneration) return;
            const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
            progressBar.style.width = `${pct}%`;
            progressMsg.textContent = message ? `${message} — ${pct}%` : `${pct}%`;
          },
        },
      );
      if (generation !== runGeneration) return;
      progressBar.style.width = '100%';
      progressMsg.textContent = 'Done';
      if (browsing) {
        // The interactive table list is the result of a browse; the report's own
        // table would only repeat it.
        outputHost.innerHTML = '';
        renderTables(result);
      } else {
        renderOutput(result);
      }
      renderOutputs(result);
      renderStats(result);
      renderNotes(result);
      resultWrap.hidden = false;
    } catch (error) {
      if (generation !== runGeneration) return;
      const err = error as Error & { hint?: string };
      if (err.name === 'AbortError') {
        progressMsg.textContent = 'Cancelled';
      } else {
        showError(errorBox, err.message || 'Something went wrong.', err.hint);
      }
    } finally {
      if (generation === runGeneration) {
        runBtn.disabled = false;
        runBtn.removeAttribute('aria-busy');
        runLabel.textContent = 'Run statement';
        cancelBtn.hidden = true;
        // Once there is something to clear, offer the way back.
        resetBtn.hidden = false;
        controller = null;
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Wiring                                                                */
  /* ---------------------------------------------------------------------- */

  createDropZone(dropEl, {
    accept: root.dataset.accept ?? '',
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
      syncControls();
      if (file) void run({ action: 'browse' });
    },
  });

  listEl.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]');
    if (!button) return;
    runGeneration += 1;
    controller?.abort();
    controller = null;
    file = null;
    renderFileList();
    progressWrap.hidden = true;
    resultWrap.hidden = true;
    syncControls();
  });

  runBtn.addEventListener('click', () => {
    // The statement in the editor is what runs, together with the export choice.
    const format = exportEl.value === 'csv' || exportEl.value === 'json' ? exportEl.value : 'none';
    void run({ action: 'query', query: queryEl.value, exportFormat: format });
  });

  cancelBtn.addEventListener('click', () => controller?.abort());

  resetBtn.addEventListener('click', () => {
    runGeneration += 1;
    controller?.abort();
    controller = null;
    file = null;
    queryEl.value = '';
    exportEl.value = 'none';
    renderFileList();
    clearError(errorBox);
    progressWrap.hidden = true;
    resultWrap.hidden = true;
    syncControls();
  });

  syncControls();
}
