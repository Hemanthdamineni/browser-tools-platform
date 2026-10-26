/**
 * The spreadsheet viewer panel.
 *
 * The pure maths live here so they are testable without a DOM: turning a
 * SheetJS worksheet into a capped grid, labelling columns, escaping CSV and
 * folding a sheet into a JSON array of objects. The panel mounts that logic
 * over a file drop zone — it parses the workbook with SheetJS (loaded on
 * demand from this origin, never a CDN), lets the user switch sheets and scan
 * the preview, then hands the chosen sheet and format to the tool's `run()` so
 * the real export (CSV / JSON / XLSX) happens in the background worker.
 *
 * Nothing here talks to the network: the workbook is read on this device.
 */
import type { CellObject, WorkBook, WorkSheet } from 'xlsx';
import type { FileRunResult } from '@/lib/types';
import { createDropZone, downloadBlob } from '@/lib/files';
import { escapeHtml, formatBytes } from '@/lib/format';
import { clearError, renderTextResult, showError } from '../workbench/shared';

/** Default preview window, so a huge sheet still opens instantly. */
export const DEFAULT_MAX_ROWS = 200;
export const DEFAULT_MAX_COLS = 30;

/** The export formats the tool understands. */
export type ExportFormat = 'csv' | 'json' | 'xlsx';

/* -------------------------------------------------------------------------- */
/*  Column labels and cell text                                                */
/* -------------------------------------------------------------------------- */

/** `0 → A`, `25 → Z`, `26 → AA`, `51 → AZ` … — Excel-style column letters. */
export function columnLabel(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/**
 * The text a cell shows: its formatted text when SheetJS produced one (dates
 * and numbers then read exactly as they do in the spreadsheet app), otherwise
 * the raw value.
 */
export function cellDisplayText(cell: CellObject | undefined): string {
  if (!cell) return '';
  if (typeof cell.w === 'string' && cell.w !== '') return cell.w;
  if (cell.v === undefined || cell.v === null) return '';
  return String(cell.v);
}

/** The used extent of a worksheet, read from its `!ref` range. Empty → 0×0. */
export function worksheetSize(ws: WorkSheet): { rows: number; cols: number } {
  const ref = ws['!ref'];
  if (typeof ref !== 'string' || ref === '') return { rows: 0, cols: 0 };
  const colon = ref.indexOf(':');
  const last = colon >= 0 ? ref.slice(colon + 1) : ref;
  // The far corner, "C10", carries the width and the height.
  const match = /([A-Z]+)(\d+)$/.exec(last.replace(/\$/g, ''));
  if (!match) return { rows: 0, cols: 0 };
  let cols = 0;
  for (const ch of match[1]!) cols = cols * 26 + (ch.charCodeAt(0) - 64);
  return { rows: Number(match[2]), cols };
}

/* -------------------------------------------------------------------------- */
/*  Grid projection                                                            */
/* -------------------------------------------------------------------------- */

/** A capped preview of a worksheet, plus the sheet's true dimensions. */
export interface GridProjection {
  /** Absolute column labels, one per shown column. */
  columnLabels: string[];
  /** Absolute 1-based row numbers, one per shown row. */
  rowNumbers: number[];
  /** The shown cells, capped to `maxRows` × `maxCols`. */
  cells: string[][];
  /** The sheet's full used size. */
  totalRows: number;
  totalCols: number;
  shownRows: number;
  shownCols: number;
  /** True when a dimension was cut down to the cap. */
  truncatedRows: boolean;
  truncatedCols: boolean;
  /** True when either dimension was cut down. */
  truncated: boolean;
}

/**
 * Project a worksheet onto a bounded grid for display. Only the cells inside
 * the cap are read, so a million-row sheet still opens instantly.
 */
export function projectSheet(ws: WorkSheet, maxRows: number, maxCols: number): GridProjection {
  const { rows: totalRows, cols: totalCols } = worksheetSize(ws);
  const rows = Math.min(Math.max(1, Math.floor(maxRows) || 1), totalRows);
  const cols = Math.min(Math.max(1, Math.floor(maxCols) || 1), totalCols);

  const cells: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(cellDisplayText(ws[`${columnLabel(c)}${r + 1}`] as CellObject | undefined));
    }
    cells.push(row);
  }

  return {
    columnLabels: Array.from({ length: cols }, (_, c) => columnLabel(c)),
    rowNumbers: Array.from({ length: rows }, (_, r) => r + 1),
    cells,
    totalRows,
    totalCols,
    shownRows: rows,
    shownCols: cols,
    truncatedRows: totalRows > rows,
    truncatedCols: totalCols > cols,
    truncated: totalRows > rows || totalCols > cols,
  };
}

/** The sheet's full used range as text — un-capped, for export. */
export function worksheetToCells(ws: WorkSheet): string[][] {
  const { rows, cols } = worksheetSize(ws);
  const cells: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(cellDisplayText(ws[`${columnLabel(c)}${r + 1}`] as CellObject | undefined));
    }
    cells.push(row);
  }
  return cells;
}

/* -------------------------------------------------------------------------- */
/*  Header detection                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A cheap guess at whether the first row is a header row. It only annotates the
 * preview — the JSON export always treats the first row as the headers.
 */
export function detectHeaderRow(ws: WorkSheet): boolean {
  const { cols } = worksheetSize(ws);
  if (cols === 0) return false;
  let text = 0;
  let filled = 0;
  for (let c = 0; c < cols; c++) {
    const cell = ws[`${columnLabel(c)}1`] as CellObject | undefined;
    if (!cell || cell.v === undefined || cell.v === null || cell.v === '') continue;
    filled += 1;
    if (cell.t === 's' || typeof cell.v === 'string') text += 1;
  }
  return filled > 0 && text / filled >= 0.75;
}

/* -------------------------------------------------------------------------- */
/*  CSV export escaping                                                        */
/* -------------------------------------------------------------------------- */

/** Escape one field for RFC 4180 CSV: quote when needed, and double any `"`. */
export function csvEscape(field: string): string {
  const s = field ?? '';
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Join a matrix of text cells into a CSV document. Blank rows are dropped and
 * lines end with LF — the same convention `csv-to-json` reads back.
 */
export function toCsvText(cells: string[][]): string {
  return cells
    .map((row) => row.map(csvEscape).join(','))
    .filter((line) => line !== '' && !/^,*$/.test(line))
    .join('\n');
}

/* -------------------------------------------------------------------------- */
/*  JSON export                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Fold a matrix into a JSON array of objects, using the first non-empty row as
 * the object keys. Returns a pretty-printed JSON string (`[]` for no rows).
 */
export function toJsonText(cells: string[][]): string {
  const rows = cells.filter((row) => row.some((cell) => cell !== ''));
  if (rows.length === 0) return '[]';
  const headers = rows[0]!;
  const objects: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    const obj: Record<string, string> = {};
    headers.forEach((header, c) => {
      obj[header || `col${c + 1}`] = row[c] ?? '';
    });
    objects.push(obj);
  }
  return JSON.stringify(objects, null, 2);
}

/* -------------------------------------------------------------------------- */
/*  Workbook metadata                                                          */
/* -------------------------------------------------------------------------- */

/** One entry per sheet, for the tab bar and the summary line. */
export interface SheetSummary {
  name: string;
  index: number;
  rows: number;
  cols: number;
}

/** Every sheet in the workbook with its live size. */
export function sheetSummaries(wb: WorkBook): SheetSummary[] {
  return wb.SheetNames.map((name, index) => {
    const ws = wb.Sheets[name];
    const size = ws ? worksheetSize(ws) : { rows: 0, cols: 0 };
    return { name, index, rows: size.rows, cols: size.cols };
  });
}

/**
 * Resolve the `sheet` option — a sheet name or a 1-based index — to a real
 * sheet name. Blank picks the first sheet; an unknown name is an error the user
 * can act on. Pure, so `run()` and the panel agree on which sheet is meant.
 */
export function resolveSheetName(wb: WorkBook, sheetOption: unknown): string {
  const names = wb.SheetNames;
  if (names.length === 0) throw new Error('This workbook has no sheets.');
  const value = typeof sheetOption === 'string' ? sheetOption.trim() : '';
  if (value === '') return names[0]!;
  if (names.includes(value)) return value;
  const index = Number(value);
  if (Number.isInteger(index) && index >= 1 && index <= names.length) return names[index - 1]!;
  throw new Error(`There is no sheet called “${value}”.`);
}

/* -------------------------------------------------------------------------- */
/*  File kinds                                                                 */
/* -------------------------------------------------------------------------- */

/** Extensions SheetJS can read as a workbook. */
export const SPREADSHEET_EXTENSIONS = ['xlsx', 'xlsm', 'xlsb', 'xls', 'ods', 'csv', 'tsv'];

/**
 * Whether a file name looks like a spreadsheet this tool can open.
 *
 * SheetJS parses almost any bytes as CSV rather than failing, so a text file
 * with the wrong extension would silently become a one-cell workbook. Checking
 * the name keeps that from happening.
 */
export function isSpreadsheetName(name: string): boolean {
  const match = /\.([A-Za-z0-9]+)$/.exec(name ?? '');
  return match ? SPREADSHEET_EXTENSIONS.includes(match[1]!.toLowerCase()) : false;
}

/* -------------------------------------------------------------------------- */
/*  SheetJS                                                                    */
/* -------------------------------------------------------------------------- */

/** The slice of SheetJS this panel calls — `read` — loaded on demand. */
interface XlsxModule {
  read(data: Uint8Array, options: { type: 'array' }): WorkBook;
}

let xlsxPromise: Promise<XlsxModule> | null = null;

/**
 * Load SheetJS once, lazily.
 *
 * A static import would put the ~1 MB parser in the panel chunk, which loads
 * the moment the tool page opens; the module is only fetched when a file is
 * actually chosen. It is bundled from `node_modules` by the build, so it is
 * served from this origin — there is no CDN request.
 */
function loadXlsx(): Promise<XlsxModule> {
  xlsxPromise ??= import('xlsx');
  return xlsxPromise;
}

/** Parse a workbook from a file, or throw a message the user can act on. */
export async function parseWorkbook(file: File): Promise<WorkBook> {
  if (!isSpreadsheetName(file.name)) {
    throw new Error('This file is not a spreadsheet this tool can read (XLSX, XLS, ODS or CSV).');
  }
  const XLSX = await loadXlsx();
  const bytes = new Uint8Array(await file.arrayBuffer());
  let wb: WorkBook;
  try {
    wb = XLSX.read(bytes, { type: 'array' });
  } catch {
    throw new Error('This file is not a spreadsheet this tool can read (XLSX, XLS, ODS or CSV).');
  }
  if (!wb.SheetNames.length) {
    throw new Error('This file has no sheets to show.');
  }
  return wb;
}

/* -------------------------------------------------------------------------- */
/*  Panel state                                                                */
/* -------------------------------------------------------------------------- */

export interface GridViewModel {
  tabs: SheetSummary[];
  activeIndex: number;
  projection: GridProjection;
  /** Whether the first row reads as a header (shown as a hint). */
  headerLooksLikeHeader: boolean;
}

/** Build the whole view model for a workbook and a selected sheet. */
export function buildGridViewModel(
  wb: WorkBook,
  activeIndex: number,
  maxRows: number,
  maxCols: number,
): GridViewModel {
  const tabs = sheetSummaries(wb);
  const index = Math.min(Math.max(0, activeIndex), Math.max(0, tabs.length - 1));
  const ws = wb.Sheets[tabs[index]?.name ?? ''];
  return {
    tabs,
    activeIndex: index,
    projection: projectSheet(ws ?? ({} as WorkSheet), maxRows, maxCols),
    headerLooksLikeHeader: ws ? detectHeaderRow(ws) : false,
  };
}

/** "3 columns · 1,204 rows · showing the first 200" — the summary line. */
export function describeSheet(view: GridViewModel): string {
  const { projection } = view;
  const rows = projection.totalRows.toLocaleString();
  const cols = projection.totalCols.toLocaleString();
  if (!projection.truncated) {
    return `${rows} row${projection.totalRows === 1 ? '' : 's'} × ${cols} column${projection.totalCols === 1 ? '' : 's'}.`;
  }
  const shown = `${projection.shownRows.toLocaleString()} row${projection.shownRows === 1 ? '' : 's'}`;
  const shownCols = `${projection.shownCols.toLocaleString()} column${projection.shownCols === 1 ? '' : 's'}`;
  return `Showing the first ${shown} and ${shownCols} of ${rows} rows × ${cols} columns. The export uses the whole sheet.`;
}

/* -------------------------------------------------------------------------- */
/*  Mount                                                                      */
/* -------------------------------------------------------------------------- */

/** Mount the spreadsheet panel into a `[data-spreadsheet-viewer-panel]` element. */
export function mountSpreadsheetViewerPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'spreadsheet-viewer';
  const dropEl = root.querySelector<HTMLElement>('[data-drop]')!;
  const listEl = root.querySelector<HTMLUListElement>('[data-file-list]')!;
  const statusEl = root.querySelector<HTMLElement>('[data-status]')!;
  const tabsEl = root.querySelector<HTMLElement>('[data-tabs]')!;
  const gridEl = root.querySelector<HTMLElement>('[data-grid]')!;
  const summaryEl = root.querySelector<HTMLElement>('[data-summary]')!;
  const headerHintEl = root.querySelector<HTMLElement>('[data-header-hint]')!;
  const rowsSel = root.querySelector<HTMLSelectElement>('[data-max-rows]')!;
  const formatSel = root.querySelector<HTMLSelectElement>('[data-format]')!;
  const runBtn = root.querySelector<HTMLButtonElement>('[data-run]')!;
  const cancelBtn = root.querySelector<HTMLButtonElement>('[data-cancel]')!;
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-reset]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-error]')!;
  const progressWrap = root.querySelector<HTMLElement>('[data-progress-wrap]')!;
  const progressBar = root.querySelector<HTMLElement>('[data-progress-bar]')!;
  const progressMsg = root.querySelector<HTMLElement>('[data-progress-msg]')!;
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]')!;
  const reportEl = root.querySelector<HTMLElement>('[data-report]')!;
  const outputsEl = root.querySelector<HTMLUListElement>('[data-outputs]')!;
  const notesEl = root.querySelector<HTMLUListElement>('[data-notes]')!;

  if (
    !dropEl ||
    !listEl ||
    !statusEl ||
    !tabsEl ||
    !gridEl ||
    !summaryEl ||
    !headerHintEl ||
    !rowsSel ||
    !formatSel ||
    !runBtn ||
    !cancelBtn ||
    !resetBtn ||
    !errorBox ||
    !progressWrap ||
    !progressBar ||
    !progressMsg ||
    !resultWrap ||
    !reportEl ||
    !outputsEl ||
    !notesEl
  ) {
    return;
  }

  let file: File | null = null;
  let workbook: WorkBook | null = null;
  let activeIndex = 0;
  let controller: AbortController | null = null;
  // Bumped on every run and on reset, so a late worker reply can never publish
  // a stale result.
  let generation = 0;

  const maxRows = (): number => {
    const value = Number(rowsSel.value);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_MAX_ROWS;
  };

  function announce(message: string): void {
    statusEl.textContent = message;
  }

  /* ---------------------------------------------------------------------- */
  /*  Rendering                                                              */
  /* ---------------------------------------------------------------------- */

  function renderList(): void {
    listEl.innerHTML = file
      ? `<li class="flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5">
          <span class="truncate">${escapeHtml(file.name)}</span>
          <span class="flex items-center gap-2 shrink-0 text-xs text-[rgb(var(--text-muted))]">
            ${formatBytes(file.size)}
            <button type="button" data-remove aria-label="Remove ${escapeHtml(file.name)}" class="hover:text-[rgb(var(--danger))]">✕</button>
          </span>
        </li>`
      : '';
    resetBtn.hidden = !file;
  }

  function renderTabs(tabs: SheetSummary[], active: number): void {
    tabsEl.innerHTML = tabs
      .map((tab) => {
        const on = tab.index === active;
        const cls = on
          ? 'bg-[rgb(var(--accent-soft))] text-[rgb(var(--text))]'
          : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]';
        return `<button type="button" role="tab" aria-selected="${on ? 'true' : 'false'}" data-tab="${tab.index}"
          class="rounded-md px-3 py-1.5 text-sm font-medium ${cls}">${escapeHtml(tab.name)}
          <span class="ml-1 text-xs opacity-60">${tab.rows.toLocaleString()}×${tab.cols.toLocaleString()}</span></button>`;
      })
      .join('');
  }

  function renderGrid(view: GridViewModel): void {
    const { projection } = view;
    const rows = projection.cells
      .map((row, r) => {
        const head = view.headerLooksLikeHeader && r === 0;
        const cells = row
          .map(
            (cell) =>
              `<td class="whitespace-nowrap border px-2 py-1${head ? ' font-semibold' : ''}">${escapeHtml(cell)}</td>`,
          )
          .join('');
        return `<tr><th scope="row" class="border px-2 py-1 text-right text-xs text-[rgb(var(--text-muted))]">${projection.rowNumbers[r]}</th>${cells}</tr>`;
      })
      .join('');
    const columns = projection.columnLabels
      .map(
        (label) =>
          `<th scope="col" class="sticky top-0 border px-2 py-1 text-left text-xs font-medium text-[rgb(var(--text-muted))]" style="background-color: rgb(var(--bg-inset))">${label}</th>`,
      )
      .join('');
    gridEl.innerHTML =
      projection.totalRows === 0
        ? `<p class="text-sm text-[rgb(var(--text-muted))]">This sheet is empty.</p>`
        : `<div class="max-h-[26rem] overflow-auto rounded-lg border">
            <table class="w-full border-collapse text-left text-sm" aria-label="Sheet preview">
              <thead><tr><th class="sticky top-0 border px-2 py-1" style="background-color: rgb(var(--bg-inset))">#</th>${columns}</tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
    summaryEl.textContent = describeSheet(view);
    headerHintEl.hidden = !view.headerLooksLikeHeader;
  }

  function redraw(): void {
    if (!workbook) {
      tabsEl.innerHTML = '';
      gridEl.innerHTML = '';
      summaryEl.textContent = '';
      headerHintEl.hidden = true;
      runBtn.disabled = true;
      return;
    }
    const view = buildGridViewModel(workbook, activeIndex, maxRows(), DEFAULT_MAX_COLS);
    activeIndex = view.activeIndex;
    renderTabs(view.tabs, view.activeIndex);
    renderGrid(view);
    runBtn.disabled = false;
  }

  /* ---------------------------------------------------------------------- */
  /*  File selection                                                         */
  /* ---------------------------------------------------------------------- */

  function setFile(next: File | null): void {
    file = next;
    workbook = null;
    activeIndex = 0;
    clearError(errorBox);
    resultWrap.hidden = true;
    outputsEl.innerHTML = '';
    notesEl.innerHTML = '';
    reportEl.hidden = true;
    renderList();
    redraw();

    if (!next) {
      announce('Choose a spreadsheet to see its sheets and grid.');
      return;
    }

    const token = ++generation;
    announce('Opening the workbook…');
    void parseWorkbook(next)
      .then((wb) => {
        if (token !== generation) return;
        workbook = wb;
        const count = wb.SheetNames.length;
        announce(`${count} sheet${count === 1 ? '' : 's'} — pick one below, then convert it.`);
        redraw();
      })
      .catch((error: unknown) => {
        if (token !== generation) return;
        const message = error instanceof Error ? error.message : 'That file could not be opened.';
        showError(errorBox, message, 'SheetJS reads XLSX, XLS, ODS and CSV.');
        announce('The file could not be opened.');
      });
  }

  const dz = createDropZone(dropEl, {
    accept: root.dataset.accept || undefined,
    multiple: false,
    onFiles: (files) => {
      const next = files[0] ?? null;
      if (next) setFile(next);
    },
  });

  listEl.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('[data-remove]')) setFile(null);
  });

  tabsEl.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-tab]');
    if (!button) return;
    activeIndex = Number(button.dataset.tab) || 0;
    redraw();
  });

  rowsSel.addEventListener('change', () => redraw());

  /* ---------------------------------------------------------------------- */
  /*  Running the export                                                     */
  /* ---------------------------------------------------------------------- */

  function renderResult(result: FileRunResult): void {
    resultWrap.hidden = false;

    if (result.report) {
      renderTextResult(reportEl, {
        output: result.report.output,
        render: result.report.render,
        language: result.report.language,
      });
      reportEl.hidden = false;
    } else {
      reportEl.hidden = true;
      reportEl.innerHTML = '';
    }

    outputsEl.innerHTML = '';
    for (const output of result.outputs) {
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between gap-3 rounded-lg border px-3 py-2';
      const name = document.createElement('span');
      name.className = 'truncate text-sm';
      name.textContent = `${output.filename} · ${formatBytes(output.blob.size)}`;
      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'btn btn-subtle btn-sm shrink-0';
      save.textContent = 'Save';
      save.addEventListener('click', () => downloadBlob(output.blob, output.filename));
      li.append(name, save);
      outputsEl.append(li);
    }

    notesEl.innerHTML = '';
    for (const warning of result.warnings ?? []) {
      const li = document.createElement('li');
      li.style.color = 'rgb(var(--warning))';
      li.textContent = `⚠ ${warning}`;
      notesEl.append(li);
    }
    for (const note of result.notes ?? []) {
      const li = document.createElement('li');
      li.className = 'text-[rgb(var(--text-muted))]';
      li.textContent = note;
      notesEl.append(li);
    }
  }

  async function run(): Promise<void> {
    if (!file || !workbook) return;
    const sheet = workbook.SheetNames[activeIndex] ?? '';

    controller?.abort();
    const token = ++generation;
    controller = new AbortController();
    clearError(errorBox);
    runBtn.disabled = true;
    cancelBtn.hidden = false;
    progressWrap.hidden = false;
    progressBar.style.width = '0%';
    progressMsg.textContent = 'Converting…';
    resultWrap.hidden = true;

    try {
      // The worker is loaded on demand, so the registry stays out of every
      // page that never converts anything.
      const { runToolById } = await import('@/lib/worker/client');
      const result = await runToolById<FileRunResult>(
        toolId,
        {
          files: [file],
          options: {
            sheet,
            format: formatSel.value,
            maxRows: maxRows(),
            maxCols: DEFAULT_MAX_COLS,
          },
        },
        {
          signal: controller.signal,
          onProgress: (fraction, message) => {
            if (token !== generation) return;
            const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
            progressBar.style.width = `${pct}%`;
            progressMsg.textContent = message ? `${message} — ${pct}%` : `${pct}%`;
          },
        },
      );
      if (token !== generation) return;
      progressBar.style.width = '100%';
      progressMsg.textContent = 'Done';
      renderResult(result);
    } catch (error) {
      if (token !== generation) return;
      const err = error as Error & { hint?: string };
      if (err.name !== 'AbortError') {
        showError(errorBox, err.message || 'The conversion failed', err.hint);
      } else {
        progressMsg.textContent = 'Cancelled';
      }
    } finally {
      if (token === generation) {
        runBtn.disabled = false;
        cancelBtn.hidden = true;
        controller = null;
      }
    }
  }

  runBtn.addEventListener('click', () => void run());
  cancelBtn.addEventListener('click', () => controller?.abort());
  resetBtn.addEventListener('click', () => {
    generation += 1;
    controller?.abort();
    controller = null;
    setFile(null);
    progressWrap.hidden = true;
    resultWrap.hidden = true;
  });

  window.addEventListener(
    'beforeunload',
    () => {
      controller?.abort();
      generation += 1;
      dz.destroy();
    },
    { once: true },
  );

  renderList();
  redraw();
}
