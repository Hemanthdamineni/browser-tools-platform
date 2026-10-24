/**
 * The spreadsheet viewer — the export module.
 *
 * The panel owns the browser APIs (file drop, live grid, sheet tabs) and hands
 * this module the file plus the sheet/format the user picked. `run()` parses
 * the workbook with SheetJS in the background worker, shows a capped grid
 * preview and produces the requested CSV, JSON or XLSX.
 *
 * Everything is on-device: the workbook is read here and the converted file is
 * written to disk from the page — no bytes ever leave the tab.
 */
import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import type { WorkBook } from 'xlsx';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import {
  toCsvText,
  toJsonText,
  projectSheet,
  resolveSheetName,
  worksheetToCells,
  isSpreadsheetName,
  DEFAULT_MAX_ROWS,
  DEFAULT_MAX_COLS,
} from '@/components/panels/spreadsheet-viewer-panel';
import { meta } from './spreadsheet-viewer.meta';

/** Clamp a numeric option into its sane range. */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** A safe output file name: input base + the format's extension. */
export function outputNameFor(name: string, format: string): string {
  const base = (name || 'spreadsheet').replace(/\.[^./\\]+$/, '') || 'spreadsheet';
  const ext = format === 'json' ? 'json' : format === 'xlsx' ? 'xlsx' : 'csv';
  return `${base}.${ext}`;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const format = typeof o.format === 'string' && ['csv', 'json', 'xlsx'].includes(o.format)
    ? o.format
    : 'csv';
  const maxRows = clampInt(o.maxRows, 1, 1000, DEFAULT_MAX_ROWS);
  const maxCols = clampInt(o.maxCols, 1, 200, DEFAULT_MAX_COLS);

  if (!input.files.length) {
    throw new ToolError('Choose a spreadsheet file.', 'XLSX, XLS, ODS and CSV are supported.');
  }
  const file = input.files[0]!;
  if (file.size === 0) {
    throw new ToolError('That file is empty.', 'Choose a spreadsheet with some cells in it.');
  }
  // SheetJS parses almost any bytes as CSV, so the file kind is checked by name
  // before anything is read — a stray .json or .txt never becomes a column.
  if (!isSpreadsheetName(file.name)) {
    throw new ToolError(
      `“${file.name}” is not a spreadsheet file.`,
      'Open an XLSX, XLS, ODS or CSV file.',
    );
  }

  input.onProgress?.(0.15, 'Reading the workbook');
  const XLSX = await import('xlsx');
  const bytes = new Uint8Array(await file.arrayBuffer());

  let wb: WorkBook;
  try {
    wb = XLSX.read(bytes, { type: 'array' });
  } catch {
    throw new ToolError(
      'This file is not a spreadsheet this tool can read.',
      'SheetJS opens XLSX, XLS, ODS and CSV — check the file and try again.',
    );
  }
  if (!wb.SheetNames.length) {
    throw new ToolError('This workbook has no sheets.', 'Open a file that holds at least one sheet.');
  }

  let sheetName: string;
  try {
    sheetName = resolveSheetName(wb, o.sheet);
  } catch (error) {
    throw new ToolError(
      error instanceof Error ? error.message : 'The chosen sheet could not be found.',
      'Pick a sheet from the list, or leave it blank for the first sheet.',
    );
  }
  const sheet = wb.Sheets[sheetName]!;
  const totalSheets = wb.SheetNames.length;

  input.onProgress?.(0.5, 'Building the preview');
  const preview = projectSheet(sheet, maxRows, maxCols);

  input.onProgress?.(0.7, 'Converting');
  let blob: Blob;
  const filename = outputNameFor(file.name, format);

  if (format === 'csv') {
    blob = new Blob([toCsvText(worksheetToCells(sheet))], {
      type: 'text/csv;charset=utf-8',
    });
  } else if (format === 'json') {
    blob = new Blob([toJsonText(worksheetToCells(sheet))], {
      type: 'application/json;charset=utf-8',
    });
  } else {
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer;
    blob = new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  input.onProgress?.(1, 'Done');

  const notes: string[] = [];
  const warnings: string[] = [];
  const cellCount = preview.totalRows * preview.totalCols;
  if (preview.truncated) {
    notes.push(
      `The preview shows the first ${preview.shownRows} row${preview.shownRows === 1 ? '' : 's'} and ${preview.shownCols} column${preview.shownCols === 1 ? '' : 's'} — the export uses the whole sheet.`,
    );
  }
  if (preview.totalRows * preview.totalCols > 1_000_000) {
    warnings.push(
      'This sheet has over a million cells. Converting the whole sheet may take a moment in the background worker.',
    );
  }
  if (format === 'xlsx' && /\.(xlsm|xlsb)$/i.test(file.name)) {
    warnings.push('Re-saved as a modern XLSX — VBA macros are not carried over.');
  }

  return {
    outputs: [{ filename, blob }],
    report: {
      output: JSON.stringify({
        headers: preview.columnLabels,
        rows: preview.cells,
      }),
      render: 'table',
    },
    stats: {
      sheets: totalSheets,
      rows: preview.totalRows,
      cols: preview.totalCols,
      cells: cellCount,
      format,
      bytes: blob.size,
    },
    notes: notes.length ? notes : undefined,
    warnings: warnings.length ? warnings : undefined,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;