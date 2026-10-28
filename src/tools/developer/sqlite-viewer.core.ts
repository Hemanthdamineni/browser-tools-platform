/**
 * Pure, unit-testable core for `sqlite-viewer`.
 *
 * Design
 * ------
 * Nothing here loads WebAssembly or touches the DOM: the open `sql.js`
 * `Database` is *passed in*, so schema listing, query execution and the CSV /
 * JSON serialisers are all testable with an in-memory database created in the
 * test file. Loading the wasm glue lives in `sqlite-viewer.tool.ts`, which
 * mirrors the split used by `pdf-protect`.
 *
 * Edge cases handled here
 * -----------------------
 * - non-SELECT statements          → `ToolError` (this is a *viewer*: a stray
 *   UPDATE must never mutate the user's file silently).
 * - multiple statements            → `ToolError`, with the offending tail.
 * - queries that return no rows    → valid empty result, not an error.
 * - NULL, BLOB and non-finite
 *   numbers                        → mapped to `''` / `null` / quoted text so
 *   every cell survives the CSV and JSON round-trip.
 * - values containing quotes,
 *   commas or newlines             → RFC 4180 quoting in `toCsv`.
 */
import { ToolError } from '@/lib/types';

/** Hard ceiling for a single input file; a browser tab is likely to choke beyond this. */
export const MAX_INPUT_BYTES = 512 * 1024 * 1024;

/** The first keyword a statement must have for the viewer to run it. */
const SELECT_RE = /^\s*(SELECT|WITH|VALUES|PRAGMA|EXPLAIN)\b/i;

/** A table row of the schema report. */
export interface TableInfo {
  name: string;
  /** CREATE statement, as stored by SQLite. */
  ddl: string;
  columns: { name: string; type: string; notNull: boolean; pk: boolean }[];
  rows: number;
}

/** The shape of an executed query, ready for the workbench's table render. */
export interface QueryOutput {
  headers: string[];
  rows: string[][];
}

/** Render a cell the way the workbench's table expects: always a string. */
export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Uint8Array) return `BLOB (${value.length} bytes)`;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value);
    return String(value);
  }
  return String(value);
}

/** Quote one CSV cell per RFC 4180: only when it has to be. */
export function csvCell(value: string): string {
  if (value.includes('"') || value.includes(',') || /[\r\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/** Serialise a result as RFC 4180 CSV with a header row. */
export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  return lines.join('\n');
}

/** JSON value for one cell: `null` stays `null`, BLOBs become byte counts. */
export function cellToJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Uint8Array) return { blob: value.length };
  return value;
}

/** Serialise a result as a JSON array of row objects. */
export function toJson(headers: string[], rawRows: unknown[][]): string {
  const out = rawRows.map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      obj[h] = cellToJson(row[i]);
    });
    return obj;
  });
  return JSON.stringify(out, null, 2);
}

/** Build the workbench's `{ headers, rows }` view of a result. */
export function toTable(result: QueryOutput): string {
  return JSON.stringify(result);
}

/**
 * Assert the statement is read-only. The regex runs before the wasm engine
 * sees the SQL: refusing here means a malformed or dangerous statement never
 * reaches the database at all.
 */
export function assertReadOnly(sql: string): void {
  if (!sql.trim()) {
    throw new ToolError('Enter a SELECT query to run.');
  }
  if (!SELECT_RE.test(sql)) {
    throw new ToolError(
      'Only read queries are allowed.',
      'Start the statement with SELECT, WITH, VALUES, PRAGMA or EXPLAIN.',
    );
  }
  // One statement at a time: a trailing `;` is fine, a second statement is not.
  const tail = sql.replace(/\s+$/, '').replace(/;\s*$/, '');
  if (/(;)/.test(tail.replace(/'(?:[^']|'')*'/g, "''").replace(/"(?:[^"]|"")*"/g, '""'))) {
    throw new ToolError('Run one statement at a time.', 'Remove the extra semicolon.');
  }
}

/** Minimal structural view of an open sql.js database — keeps this module pure. */
export interface SqliteDatabase {
  exec(sql: string): { columns: string[]; values: unknown[][] }[];
}

/**
 * Read the schema of an open database: every table with its CREATE statement,
 * its columns and its row count. Internal `sqlite_*` tables are skipped.
 */
export function listTables(db: SqliteDatabase): TableInfo[] {
  const tables: TableInfo[] = [];

  const nameRows = db.exec(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const names = nameRows[0]?.values.map((row) => String(row[0])) ?? [];

  for (const name of names) {
    const quoted = `"${name.replace(/"/g, '""')}"`;
    const ddlRows = db.exec(
      `SELECT sql FROM sqlite_master WHERE name = '${name.replace(/'/g, "''")}'`,
    );
    const ddl = String(ddlRows[0]?.values[0]?.[0] ?? '');
    const countRows = db.exec(`SELECT COUNT(*) FROM ${quoted}`);
    const rows = Number(countRows[0]?.values[0]?.[0] ?? 0);

    const columns: TableInfo['columns'] = [];
    const infoRows = db.exec(`PRAGMA table_info(${quoted})`);
    for (const row of infoRows[0]?.values ?? []) {
      // PRAGMA table_info columns: cid, name, type, notnull, dflt_value, pk.
      columns.push({
        name: String(row[1]),
        type: String(row[2] ?? ''),
        notNull: Number(row[3]) === 1,
        pk: Number(row[5]) > 0,
      });
    }

    tables.push({ name, ddl, columns, rows });
  }

  return tables;
}

/**
 * Execute one read-only statement against the open database and return both
 * the workbench table view and the raw rows for the JSON export.
 */
export function runQuery(db: SqliteDatabase, sql: string): QueryOutput & { rawRows: unknown[][] } {
  assertReadOnly(sql);

  let results: { columns: string[]; values: unknown[][] }[];
  try {
    results = db.exec(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ToolError(`Query failed: ${message}`);
  }

  const first = results[0];
  // sql.js's `exec` omits the result entirely when a statement returns zero
  // rows — the column names would be lost. Fall back to `prepare` + `step`,
  // which reports the columns of a query with no matching rows.
  const headers = first?.columns ?? (results.length ? [] : columnsWithoutRows(db, sql));
  const rawRows = first?.values ?? [];
  return {
    headers,
    rows: rawRows.map((row) => row.map(cellToString)),
    rawRows,
  };
}

/** The slice of sql.js's statement API the empty-result fallback needs. */
export interface SqliteStatement {
  step(): boolean;
  getColumnNames(): string[];
  free(): boolean;
}

/** Column names of a query that matched no rows, via the statement API. */
function columnsWithoutRows(db: SqliteDatabase, sql: string): string[] {
  const stmtApi = db as SqliteDatabase & { prepare(sql: string): SqliteStatement };
  let stmt: SqliteStatement | undefined;
  try {
    stmt = stmtApi.prepare(sql);
    stmt.step(); // false: no rows, but the statement now knows its columns.
    return stmt.getColumnNames();
  } catch {
    return [];
  } finally {
    stmt?.free();
  }
}
