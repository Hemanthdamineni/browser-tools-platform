/**
 * The SQLite viewer tool.
 *
 * Opens a local `.db` / `.sqlite` file with sql.js — SQLite compiled to
 * WebAssembly — and answers a single request: browse the tables, dump the
 * schema, or run one read-only statement. The heavy engine is pulled in with a
 * lazy `import()` on first use (the same trick as qpdf in
 * `pdf-protect.qpdf.ts`), so neither the sql.js glue nor its `.wasm` ships in
 * the main bundle or any other tool's chunk. The `.wasm` binary is fetched
 * from this origin through `locateFile`.
 *
 * The file is read from disk into this worker's memory once per run; it is
 * never written back, and the engine refuses every statement that could change
 * the in-memory copy (see `collectViewerResult` in `sqlite-viewer.core.ts`).
 * The work happens on the Web Worker, so a large database never freezes the
 * tab.
 */
import type {
  ExportFormat,
  SqlDatabase,
  ViewerAction,
  ViewerRequest,
  ViewerResult,
} from './sqlite-viewer.core';
import {
  READ_ONLY_HINT,
  classifyStatement,
  collectViewerResult,
  refusalMessage,
} from './sqlite-viewer.core';
import { resolveOptions } from '@/lib/options';
import type { FileRunInput, FileRunResult, FileToolModule, OptionValues } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './sqlite-viewer.meta';
import type { SqlJsDatabase, SqlJsModule } from 'sql.js/dist/sql-wasm-browser.js';
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';

/** Largest file the viewer will open. SQLite pages are usually tiny; this guards the worker. */
const MAX_DB_BYTES = 200 * 1024 * 1024;

/** The loaded sql.js module, cached for the lifetime of the worker. */
let sqlJsPromise: Promise<SqlJsModule> | null = null;

/**
 * Load sql.js once, pointing it at the bundled (same-origin) `.wasm`.
 *
 * Deliberately a dynamic `import()`, not a static one: the glue is ~100 KB of
 * Emscripten runtime that should only land in a chunk for the run that needs
 * it. A failed load is not cached, so a transient fetch failure can be retried
 * by the next run.
 */
async function loadSqlJs(): Promise<SqlJsModule> {
  sqlJsPromise ??= (async () => {
    const { default: initSqlJs } = await import('sql.js/dist/sql-wasm-browser.js');
    return initSqlJs({
      locateFile: (file) => (file === 'sql-wasm-browser.wasm' ? wasmUrl : file),
    });
  })().catch((error: unknown) => {
    sqlJsPromise = null;
    throw error;
  });
  return sqlJsPromise;
}

/** Validate and normalise the parsed option values. */
function exportFormatOf(value: unknown): ExportFormat {
  return value === 'csv' || value === 'json' ? value : 'none';
}

function actionOf(value: unknown): ViewerAction {
  return value === 'schema' || value === 'query' ? value : 'browse';
}

/** A `File` worth opening. */
function firstFile(input: FileRunInput): File {
  if (!input.files?.length) throw new ToolError('Choose a SQLite database file.');
  return input.files[0]!;
}

/**
 * Turn a `ViewerResult` into the `FileRunResult` the workbench knows: the
 * report renders inline and the CSV / JSON export becomes a downloadable file.
 */
export function toFileResult(result: ViewerResult, sourceName: string): FileRunResult {
  const base = sourceName.replace(/\.[^./\\]+$/, '') || 'query';
  const outputs: FileRunResult['outputs'] = [];
  if (result.exportText) {
    const format = result.exportText.format;
    const blob = new Blob([result.exportText.contents], {
      type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json',
    });
    outputs.push({ filename: `${base}.${format}`, blob });
  }
  return {
    outputs,
    report: result.report,
    notes: result.notes,
    warnings: result.warnings,
    stats: result.stats,
  };
}

/**
 * Turn the options into a request the engine can run.
 *
 * A statement the user typed wins over the "Show" selection, so the panel's Run
 * button and the examples both behave the same way. The statement is classified
 * here — before sql.js is even loaded — and a refusal is raised as a
 * `ToolError`, so a write is stopped without paying for the engine.
 * `collectViewerResult` classifies again before running, so this is the
 * friendly early exit, not the only gate.
 */
export function planRequest(o: OptionValues): ViewerRequest {
  const maxRowsRaw = Number(o.maxRows ?? 500);
  const request: ViewerRequest = {
    action: actionOf(o.action),
    sql: '',
    table: String(o.table ?? '').trim(),
    exportFormat: exportFormatOf(o.export),
    maxRows: Number.isFinite(maxRowsRaw) ? Math.max(1, Math.floor(maxRowsRaw)) : 500,
  };

  const query = String(o.query ?? '').trim();
  if (!query) return request;

  const classified = classifyStatement(query);
  const refusal = refusalMessage(classified);
  if (refusal) throw new ToolError(refusal, READ_ONLY_HINT);

  if (classified.kind === 'meta') {
    request.action = classified.command === 'tables' ? 'browse' : 'schema';
    request.table = classified.table || request.table;
    return request;
  }
  if (classified.kind === 'read') {
    request.action = 'query';
    request.sql = classified.sql;
  }
  return request;
}

/**
 * Run one request against an already-open database. This is the seam the tests
 * use: they open a real sql.js `Database` with the wasm passed as a buffer and
 * drive every path through here, without a Worker or a fetch.
 */
export function runWithDb(db: SqlDatabase, input: FileRunInput): ViewerResult {
  const o = resolveOptions(meta, input.options);
  const file = firstFile(input);
  return collectViewerResult(db, planRequest(o), {
    fileName: file.name,
    fileSize: file.size,
  });
}

/** Wrap an sql.js error (e.g. "file is not a database") in a friendly message. */
function friendlyDbError(error: unknown, fileName: string): never {
  const message = error instanceof Error ? error.message : '';
  if (/not a database|malformed/i.test(message)) {
    throw new ToolError(
      `${fileName} is not a SQLite database.`,
      'The file must be a SQLite database (.db, .sqlite, .sqlite3 or .db3) read from disk.',
    );
  }
  if (/no such (table|column)|syntax error|near |incomplete input/i.test(message)) {
    throw new ToolError(`That statement failed: ${message}`);
  }
  throw error instanceof Error ? error : new Error(String(error));
}

/** Open the file's bytes as a database, turning SQLite's errors into ToolErrors. */
function openDatabase(SQL: SqlJsModule, bytes: Uint8Array, fileName: string): SqlJsDatabase {
  try {
    const db = new SQL.Database(bytes);
    // Force the open: SQLite otherwise defers a "not a database" failure until
    // the first query.
    db.exec('SELECT 1;');
    return db;
  } catch (error) {
    friendlyDbError(error, fileName);
  }
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const file = firstFile(input);
  if (!file.size) throw new ToolError('That file is empty.');
  if (file.size > MAX_DB_BYTES) {
    throw new ToolError(
      `That database is ${(file.size / (1024 * 1024)).toFixed(1)} MB, which is too large for the viewer.`,
      'Choose a smaller database.',
    );
  }
  // Plan (and refuse a write) before the engine is loaded: a rejected statement
  // should not cost the visitor a 700 KB download.
  const request = planRequest(o);
  input.signal?.throwIfAborted?.();
  input.onProgress?.(0.1, 'Reading database');

  const bytes = new Uint8Array(await file.arrayBuffer());
  input.signal?.throwIfAborted?.();
  input.onProgress?.(0.5, 'Opening with SQLite');

  const SQL = await loadSqlJs();
  input.signal?.throwIfAborted?.();
  const db = openDatabase(SQL, bytes, file.name);
  input.onProgress?.(0.7, 'Running');
  try {
    return toFileResult(
      collectViewerResult(db, request, { fileName: file.name, fileSize: file.size }),
      file.name,
    );
  } catch (error) {
    if (error instanceof ToolError) throw error;
    friendlyDbError(error, file.name);
  } finally {
    db.close();
  }
}

const tool: FileToolModule = { meta, run };
export default tool;
