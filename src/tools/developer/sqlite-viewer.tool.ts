/**
 * The only part of `sqlite-viewer` that is allowed to load the SQL engine.
 *
 * sql.js is ~1.5 MB of WebAssembly, so the glue is pulled in with a dynamic
 * `import()` on first use — it becomes its own chunk inside the tool worker and
 * the `.wasm` binary is fetched from this origin when a run actually starts.
 * Neither is part of the main bundle or of any other tool's chunk. The module
 * instance is cached for the lifetime of the worker: the second run in a
 * session skips the download and the compile.
 */
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './sqlite-viewer.meta';
import {
  MAX_INPUT_BYTES,
  listTables,
  runQuery,
  toCsv,
  toJson,
  type SqliteDatabase,
} from './sqlite-viewer.core';

let pending: Promise<{ Database: new (data?: Uint8Array) => SqliteDatabase }> | undefined;

export function loadSqlJs(): Promise<{ Database: new (data?: Uint8Array) => SqliteDatabase }> {
  // A failed load must not be cached: a transient fetch failure would otherwise
  // break the tool for the rest of the worker's life, with no way to retry.
  pending ??= (async () => {
    // Deliberately a dynamic import, not a static one: the module specifier is
    // runtime-selected — the sql.js Emscripten glue plus its sql-wasm.wasm is
    // ~1.5 MB that must land in its own lazily loaded worker chunk, fetched
    // only for the run that needs it. A static import would pull both into the
    // tool chunk the moment its page loads. This mirrors pdf-protect.qpdf.ts.
    const { default: initSqlJs } = await import('sql.js/dist/sql-wasm.js');
    return initSqlJs({ locateFile: (file) => (file === 'sql-wasm.wasm' ? wasmUrl : file) });
  })().catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  return pending;
}

async function openDatabase(
  input: FileRunInput,
): Promise<{ db: SqliteDatabase; close: () => void }> {
  const file = input.files[0];
  if (!file) {
    if (input.text?.trim()) {
      throw new ToolError(
        'Attach a SQLite file to view.',
        'This tool opens .sqlite / .db files; paste raw SQL into the SQL Format tool instead.',
      );
    }
    throw new ToolError('Attach a SQLite database file (.sqlite, .db, .sqlite3, .db3).');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ToolError(
      `File is too large (${file.size.toLocaleString('en')} bytes).`,
      `The limit is ${MAX_INPUT_BYTES / (1024 * 1024)} MB.`,
    );
  }
  if (file.size === 0) {
    throw new ToolError('File is empty.', 'A SQLite database is never zero bytes.');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 16 || String.fromCharCode(...bytes.slice(0, 16)) !== 'SQLite format 3\x00') {
    throw new ToolError(
      'Not a SQLite 3 database.',
      'The file must start with the "SQLite format 3" magic header.',
    );
  }

  try {
    const SQL = await loadSqlJs();
    const db = new SQL.Database(bytes);
    return { db, close: () => db.close() };
  } catch (error) {
    if (error instanceof ToolError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new ToolError(`Could not open the database: ${message}`);
  }
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const format = String(input.options.exportFormat ?? 'table');
  const query = input.text?.trim() || '';
  const signal = input.signal;
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const { db, close } = await openDatabase(input);
  try {
    const tables = listTables(db);

    if (query) {
      const result = runQuery(db, query);
      input.onProgress?.(1, 'Done');

      if (format === 'csv') {
        return {
          outputs: [
            {
              filename: 'query.csv',
              blob: new Blob([toCsv(result.headers, result.rows)], { type: 'text/csv' }),
            },
          ],
          report: { output: toCsv(result.headers, result.rows), render: 'table', language: 'csv' },
          stats: { rows: result.rows.length, columns: result.headers.length },
        };
      }
      if (format === 'json') {
        const json = toJson(result.headers, result.rawRows);
        return {
          outputs: [
            { filename: 'query.json', blob: new Blob([json], { type: 'application/json' }) },
          ],
          report: { output: json, render: 'code', language: 'json' },
          stats: { rows: result.rows.length, columns: result.headers.length },
        };
      }
      return {
        outputs: [],
        report: {
          output: JSON.stringify({ headers: result.headers, rows: result.rows }),
          render: 'table',
        },
        stats: { rows: result.rows.length, columns: result.headers.length },
      };
    }

    // No query: report the schema. Tables become the workbench table; the DDL
    // of every table is listed in the notes so the user can copy it.
    const rows = tables.map((t) => [
      t.name,
      String(t.rows),
      t.columns
        .map(
          (c) => `${c.name} ${c.type}${c.pk ? ' PK' : ''}${c.notNull && !c.pk ? ' NOT NULL' : ''}`,
        )
        .join(', '),
    ]);
    input.onProgress?.(1, 'Done');

    const schema = tables.map((t) => `${t.name}: ${t.ddl}`).join('\n\n');
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['Table', 'Rows', 'Columns'],
          rows,
        }),
        render: 'table',
      },
      notes: schema ? [schema] : ['This database has no tables.'],
      stats: {
        tables: tables.length,
        totalRows: tables.reduce((sum, t) => sum + t.rows, 0),
      },
    };
  } finally {
    close();
  }
}

const tool: FileToolModule = { meta, run };
export default tool;
