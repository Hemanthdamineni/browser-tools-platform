/**
 * The SQLite viewer's pure logic: the read-only statement classifier, the
 * CSV and JSON serialisers, the schema dump and the file summary. Nothing here
 * touches the DOM, the network or sql.js itself — the engine is passed in as
 * the small `SqlDatabase` interface below, which is exactly the shape of a
 * sql.js `Database`. That keeps every rule in this file unit-testable against a
 * plain in-memory database.
 *
 * ## Read-only
 *
 * A database is opened from a copy of the file's bytes in the worker's memory,
 * so the file on disk is only ever read. Even so, every statement is classified
 * before it reaches the engine and the viewer refuses anything that could
 * change the in-memory copy: INSERT/UPDATE/DELETE/REPLACE, DDL, ATTACH/DETACH,
 * transactions, and the PRAGMAs that write. `collectViewerResult` re-checks a
 * statement before running it, so the guarantee does not depend on the caller.
 */
import { formatBytes, formatNumber } from '@/lib/format';
import { ToolError } from '@/lib/types';

/** A value as sql.js hands it back: numbers, text, NULL and BLOBs. */
export type SqlCell = string | number | null | Uint8Array;

/** One result set: the column names plus one array of values per row. */
export interface QueryResult {
  columns: string[];
  values: SqlCell[][];
}

/** The subset of a sql.js `Database` the viewer uses. */
export interface SqlDatabase {
  exec(sql: string): QueryResult[];
  close?(): void;
}

/** What the viewer is asked to show. */
export type ViewerAction = 'browse' | 'schema' | 'query';

/** How a result is exported. */
export type ExportFormat = 'none' | 'csv' | 'json';

/** A `FileRunResult.report` render kind. */
export type ReportRender = 'table' | 'code' | 'text';

export interface ViewerReport {
  output: string;
  render: ReportRender;
  language?: string;
}

/** A resolved request: the action plus everything it needs to run. */
export interface ViewerRequest {
  action: ViewerAction;
  /** The statement to run for `action: 'query'` (already classified read-only). */
  sql: string;
  /** Table, view, index or trigger whose schema to show; empty = the whole schema. */
  table: string;
  exportFormat: ExportFormat;
  maxRows: number;
}

/** Facts about the file the user chose. */
export interface ViewerContext {
  fileName: string;
  fileSize: number;
}

export interface ViewerResult {
  report: ViewerReport;
  /** Present only when the user asked for a CSV or JSON export. */
  exportText?: { contents: string; format: 'csv' | 'json' };
  notes: string[];
  warnings: string[];
  stats: Record<string, string | number>;
}

/* -------------------------------------------------------------------------- */
/*  Statement classification — the read-only gate                             */
/* -------------------------------------------------------------------------- */

export type StatementKind =
  | { kind: 'empty' }
  | { kind: 'read'; verb: string; sql: string }
  | { kind: 'meta'; command: 'tables' | 'schema'; table: string }
  | { kind: 'forbidden'; verb: string; reason: string }
  | { kind: 'multiple'; count: number }
  | { kind: 'unsupported'; token: string };

/**
 * The leading keywords the viewer runs. Everything else is refused — this is a
 * whitelist, not a blacklist: an unknown statement is rejected rather than
 * guessed at.
 */
const READ_VERBS = new Set(['SELECT', 'WITH', 'VALUES', 'TABLE', 'EXPLAIN']);

/**
 * Keywords that write, plus the transaction and maintenance verbs. They get a
 * precise message ("UPDATE cannot run here") instead of the generic one.
 */
const MUTATING_VERBS = new Set([
  'INSERT',
  'UPDATE',
  'DELETE',
  'REPLACE',
  'UPSERT',
  'DROP',
  'CREATE',
  'ALTER',
  'TRUNCATE',
  'ATTACH',
  'DETACH',
  'VACUUM',
  'REINDEX',
  'ANALYZE',
  'GRANT',
  'REVOKE',
  'BEGIN',
  'COMMIT',
  'ROLLBACK',
  'SAVEPOINT',
  'RELEASE',
]);

/**
 * The PRAGMAs that only read metadata. The rest are refused because they either
 * write (`journal_mode=WAL`, `optimize`, `incremental_vacuum` …) or change
 * behaviour in ways a viewer has no business changing. `table_info` is the one
 * the requirement names; the others are the same kind of introspection.
 */
export const READ_ONLY_PRAGMAS = new Set([
  'application_id',
  'auto_vacuum',
  'cache_size',
  'collation_list',
  'compile_options',
  'database_list',
  'encoding',
  'foreign_key_check',
  'foreign_key_list',
  'freelist_count',
  'function_list',
  'index_info',
  'index_list',
  'index_xinfo',
  'integrity_check',
  'journal_mode',
  'legacy_file_format',
  'locking_mode',
  'module_list',
  'page_count',
  'page_size',
  'pragma_list',
  'quick_check',
  'read_uncommitted',
  'recursive_triggers',
  'schema_version',
  'secure_delete',
  'synchronous',
  'table_info',
  'table_list',
  'table_xinfo',
  'temp_store',
  'threads',
  'user_version',
  'wal_autocheckpoint',
]);

interface Scan {
  /** The statement slices, split on the top-level `;` separators. */
  statements: string[];
  /**
   * One masked string per statement — the same slice with string literals,
   * quoted identifiers and comments blanked (newlines kept). `masked[i]` is the
   * masked copy of `statements[i]`.
   */
  masked: string[];
}

/**
 * Walk SQL once, splitting statements at `;` and blanking everything inside a
 * string literal, a quoted identifier or a comment. `SELECT 'drop table t'` is
 * then not mistaken for a DROP, and a `DELETE` that only appears in a comment
 * is not a statement.
 */
export function scanSql(sql: string): Scan {
  const chars = sql.split('');
  const boundaries: number[] = [];
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i]!;
    const next = chars[i + 1];

    if (ch === '-' && next === '-') {
      // Line comment: blank to the end of the line, keeping the newline.
      let j = i;
      while (j < chars.length && chars[j] !== '\n') {
        chars[j] = ' ';
        j += 1;
      }
      i = j;
      continue;
    }

    if (ch === '/' && next === '*') {
      // Block comment: blank up to and including the closing `*/`.
      let j = i + 2;
      while (j < chars.length && !(chars[j] === '*' && chars[j + 1] === '/')) {
        if (chars[j] !== '\n') chars[j] = ' ';
        j += 1;
      }
      chars[i] = ' ';
      chars[i + 1] = ' ';
      if (j < chars.length) {
        chars[j] = ' ';
        chars[j + 1] = ' ';
        j += 2;
      }
      i = j;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      // A string literal or a quoted identifier: blank it, honouring the
      // doubled-quote escape (`'it''s'`).
      let j = i + 1;
      while (j < chars.length) {
        if (chars[j] === ch) {
          chars[j] = ' ';
          if (chars[j + 1] === ch) {
            chars[j + 1] = ' ';
            j += 2;
            continue;
          }
          j += 1;
          break;
        }
        if (chars[j] !== '\n') chars[j] = ' ';
        j += 1;
      }
      chars[i] = ' ';
      i = j;
      continue;
    }

    if (ch === '[') {
      // Bracket-quoted identifier.
      let j = i + 1;
      while (j < chars.length && chars[j] !== ']') {
        if (chars[j] !== '\n') chars[j] = ' ';
        j += 1;
      }
      chars[i] = ' ';
      if (j < chars.length) {
        chars[j] = ' ';
        j += 1;
      }
      i = j;
      continue;
    }

    if (ch === ';') boundaries.push(i);
    i += 1;
  }

  // The masked text has the same length as the input, so a boundary offset
  // found in one slices the other — a `;` inside a quoted region was blanked
  // in the masked copy and never became a boundary.
  const maskedText = chars.join('');
  const statements: string[] = [];
  const masked: string[] = [];
  let start = 0;
  for (const boundary of boundaries) {
    statements.push(sql.slice(start, boundary));
    masked.push(maskedText.slice(start, boundary));
    start = boundary + 1;
  }
  statements.push(sql.slice(start));
  masked.push(maskedText.slice(start));

  return { statements, masked };
}

/**
 * Classify one statement (or one `.` command) into something the viewer can
 * run. Returns `empty` for blank input, `multiple` when the input holds more
 * than one statement, and `forbidden` / `unsupported` for everything that is
 * not a read.
 */
export function classifyStatement(sql: string): StatementKind {
  const scan = scanSql(sql);
  const parts = scan.statements
    .map((statement, index) => ({ statement, masked: scan.masked[index] ?? '' }))
    .filter((part) => part.masked.trim().length > 0);

  if (!parts.length) return { kind: 'empty' };
  if (parts.length > 1) return { kind: 'multiple', count: parts.length };

  const { statement: raw, masked } = parts[0]!;
  const statement = raw.trim();
  const text = masked.trim();

  // sqlite3 shell dot commands. A viewer has no shell, so only the two that
  // map onto a `sqlite_master` query are understood. The `.schema` argument is
  // read from the raw statement because a quoted table name is blanked in the
  // masked copy; these are shell commands, never passed to the engine, so the
  // raw text is safe to inspect.
  if (text.startsWith('.')) {
    const match = /^\.([A-Za-z]+)/.exec(text);
    const name = (match?.[1] ?? '').toLowerCase();
    if (name === 'tables') return { kind: 'meta', command: 'tables', table: '' };
    if (name === 'schema') {
      const rawMatch = /^\.schema[ \t]+(.+)$/i.exec(statement.trim());
      const argument = rawMatch?.[1] ? unquote(rawMatch[1].replace(/;\s*$/, '').trim()) : '';
      return { kind: 'meta', command: 'schema', table: argument };
    }
    return { kind: 'unsupported', token: `.${name || 'command'}` };
  }

  const verb = /^([A-Za-z_][A-Za-z0-9_$]*)/.exec(text)?.[1]?.toUpperCase() ?? '';
  if (!verb) return { kind: 'empty' };

  if (verb === 'PRAGMA') {
    const name = (/^PRAGMA[ \t]+([A-Za-z_][A-Za-z0-9_]*)/i.exec(text)?.[1] ?? '').toLowerCase();
    if (!name) return { kind: 'unsupported', token: raw.trim().split(/\s+/)[0] ?? 'PRAGMA' };
    if (text.includes('=')) {
      return { kind: 'forbidden', verb: `PRAGMA ${name}`, reason: 'it assigns a setting' };
    }
    if (!READ_ONLY_PRAGMAS.has(name)) {
      return { kind: 'forbidden', verb: `PRAGMA ${name}`, reason: 'it is not a metadata read' };
    }
    return { kind: 'read', verb: 'PRAGMA', sql: statement };
  }

  if (READ_VERBS.has(verb)) {
    // A read can still write: `WITH x AS (…) INSERT INTO t …` is one valid
    // SQLite statement. Refuse anything that names a writing verb.
    const write = (text.match(/[A-Za-z_][A-Za-z0-9_$]*/g) ?? [])
      .map((token) => token.toUpperCase())
      .find((token) => MUTATING_VERBS.has(token));
    if (write) {
      return { kind: 'forbidden', verb: write, reason: 'it appears in a statement that writes' };
    }
    return { kind: 'read', verb, sql: statement };
  }

  if (MUTATING_VERBS.has(verb)) {
    return { kind: 'forbidden', verb, reason: 'it changes the database' };
  }
  return { kind: 'unsupported', token: raw.trim().split(/\s+/)[0] ?? verb };
}

/** The hint shown with every refusal, so the message is worded once. */
export const READ_ONLY_HINT =
  'The viewer only runs SELECT, WITH, VALUES, TABLE, EXPLAIN and metadata PRAGMAs, plus the .tables and .schema shortcuts.';

/**
 * Why a statement cannot run, or `null` when it can. `collectViewerResult`
 * and the tool's request planner both use this, so a refusal is worded the
 * same way wherever it is raised.
 */
export function refusalMessage(classified: StatementKind): string | null {
  switch (classified.kind) {
    case 'forbidden':
      return `"${classified.verb}" cannot run here because ${classified.reason}.`;
    case 'multiple':
      return `Run one statement at a time: ${classified.count} were given.`;
    case 'unsupported':
      return `"${classified.token}" is not something the viewer can run.`;
    default:
      return null;
  }
}

/** Strip one layer of `"…"`, `'…'`, `` `…` `` or `[…]` around a name. */
function unquote(value: string): string {
  const trimmed = value.trim();
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if (trimmed.length >= 2 && first === last && (first === '"' || first === "'" || first === '`')) {
    return trimmed.slice(1, -1).replace(new RegExp(first + first, 'g'), first);
  }
  if (trimmed.length >= 2 && first === '[' && last === ']') return trimmed.slice(1, -1);
  return trimmed;
}

/** A double-quoted identifier, safe to paste into a statement. */
export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** A single-quoted string literal, safe to paste into a statement. */
export function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/* -------------------------------------------------------------------------- */
/*  Serialisation                                                             */
/* -------------------------------------------------------------------------- */

const BASE64_CHUNK = 0x8000;

/** Base64 for a BLOB column (btoa is available in every worker and in jsdom). */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK));
  }
  return btoa(binary);
}

/** How a value is written into a CSV or JSON file. */
export function csvField(cell: SqlCell): string {
  if (cell === null) return '';
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'number') return String(cell);
  return toBase64(cell);
}

/** How a value is shown in the preview table. */
export function displayCell(cell: SqlCell): string {
  if (cell === null) return 'NULL';
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'number') return String(cell);
  return `BLOB (${formatNumber(cell.length)} bytes)`;
}

/** RFC 4180 quoting: only when the field needs it. */
export function quoteCsvField(field: string): string {
  if (!/[",\r\n]/.test(field) && field.trim() === field) return field;
  return `"${field.replace(/"/g, '""')}"`;
}

/** The result set as RFC 4180 CSV, with a header row and CRLF line endings. */
export function toCsv(columns: string[], values: SqlCell[][]): string {
  const lines = [columns.map(quoteCsvField).join(',')];
  for (const row of values) {
    lines.push(
      columns.map((_column, index) => quoteCsvField(csvField(row[index] ?? null))).join(','),
    );
  }
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * The result set as JSON. An array of objects keyed by column name — falling
 * back to `{ columns, rows }` when two columns share a name, so no value is
 * silently dropped. BLOBs become base64 strings and NULL stays `null`.
 */
export function toJson(columns: string[], values: SqlCell[][]): string {
  const jsonValue = (cell: SqlCell): string | number | null =>
    cell === null || typeof cell === 'string' || typeof cell === 'number'
      ? cell
      : toBase64(cell);

  if (new Set(columns).size !== columns.length) {
    const rows = values.map((row) =>
      columns.map((_column, index) => jsonValue(row[index] ?? null)),
    );
    return JSON.stringify({ columns, rows }, null, 2);
  }

  const rows = values.map((row) => {
    const entry: Record<string, string | number | null> = {};
    columns.forEach((column, index) => {
      entry[column] = jsonValue(row[index] ?? null);
    });
    return entry;
  });
  return JSON.stringify(rows, null, 2);
}

/** A result set as the workbench's `render: 'table'` report. */
export function tableReport(columns: string[], values: SqlCell[][]): ViewerReport {
  return {
    output: JSON.stringify({
      headers: columns.map((column) => (column === '' ? '(no name)' : column)),
      rows: values.map((row) => row.map(displayCell)),
    }),
    render: 'table',
  };
}

/* -------------------------------------------------------------------------- */
/*  Queries                                                                   */
/* -------------------------------------------------------------------------- */

/** Only the first N tables get a `count(*)`; a 5 000-table file would crawl. */
export const MAX_COUNTED_TABLES = 200;

export interface TableEntry {
  name: string;
  type: string;
  sql: string | null;
}

const TABLES_SQL =
  "SELECT name, type, sql FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name;";

/** Every table and view in the database, in name order. */
export function listTables(db: SqlDatabase): TableEntry[] {
  const [result] = db.exec(TABLES_SQL);
  if (!result) return [];
  return result.values.map((row) => ({
    name: String(row[0] ?? ''),
    type: String(row[1] ?? ''),
    sql: typeof row[2] === 'string' ? row[2] : null,
  }));
}

/** `SELECT sqlite_version()` — shown in the summary. */
export function sqliteVersion(db: SqlDatabase): string {
  const [result] = db.exec('SELECT sqlite_version();');
  const value = result?.values[0]?.[0];
  return typeof value === 'string' ? value : 'unknown';
}

/** The `CREATE` statements of the whole schema, or of one table and its objects. */
export function schemaSql(table = ''): string {
  const where = table ? ` AND tbl_name = ${quoteLiteral(table)}` : '';
  return `SELECT name, type, sql FROM sqlite_master WHERE sql IS NOT NULL${where} ORDER BY type, name;`;
}

/** Join `CREATE` statements into one copy-pasteable script. */
export function schemaText(entries: readonly { sql: string | null }[]): string {
  return entries
    .filter((entry) => typeof entry.sql === 'string' && entry.sql.trim() !== '')
    .map((entry) => `${entry.sql!.trim().replace(/;+\s*$/, '')};`)
    .join('\n\n');
}

/** The summary shown under every result. */
export function summaryStats(input: {
  fileName: string;
  fileSize: number;
  tableCount: number;
  sqliteVersion: string;
  rowCount?: number | null;
}): Record<string, string | number> {
  const stats: Record<string, string | number> = {
    File: input.fileName,
    Size: formatBytes(input.fileSize),
    Tables: formatNumber(input.tableCount),
    SQLite: input.sqliteVersion,
  };
  if (typeof input.rowCount === 'number') stats.Rows = formatNumber(input.rowCount);
  return stats;
}

/** The empty-input answer: the table list, with counts where they are cheap. */
function tablesResult(
  db: SqlDatabase,
  tables: TableEntry[],
  context: ViewerContext,
  sqliteVersionText: string,
  notes: string[],
  warnings: string[],
): ViewerResult {
  const counted = tables.length <= MAX_COUNTED_TABLES;
  if (!counted) {
    notes.push(`Row counts are only tallied for the first ${MAX_COUNTED_TABLES} tables.`);
  }

  let totalRows = 0;
  const rows: SqlCell[][] = tables.map((table) => {
    const [info] = db.exec(`PRAGMA table_info(${quoteIdent(table.name)});`);
    const columns = info ? info.values.length : 0;
    let count = 0;
    if (counted) {
      const [tally] = db.exec(`SELECT count(*) FROM ${quoteIdent(table.name)};`);
      const value = tally?.values[0]?.[0];
      count = typeof value === 'number' ? value : 0;
      totalRows += count;
    }
    return [table.name, table.type, String(columns), counted ? formatNumber(count) : '—'];
  });

  if (!tables.length) notes.unshift('This database has no tables.');

  return {
    report: tableReport(['Table', 'Type', 'Columns', 'Rows'], rows),
    notes,
    warnings,
    stats: summaryStats({
      ...context,
      tableCount: tables.length,
      sqliteVersion: sqliteVersionText,
      rowCount: counted ? totalRows : null,
    }),
  };
}

/**
 * Run one resolved request against an open database and describe the result.
 * The statement is re-classified here, so a write can never reach the engine
 * even if the caller forgot to check.
 */
export function collectViewerResult(
  db: SqlDatabase,
  request: ViewerRequest,
  context: ViewerContext,
): ViewerResult {
  const tables = listTables(db);
  const version = sqliteVersion(db);
  const notes: string[] = [];
  const warnings: string[] = [];

  if (request.action === 'browse') {
    return tablesResult(db, tables, context, version, notes, warnings);
  }

  if (request.action === 'schema') {
    let table = request.table;
    if (table && !tables.some((entry) => entry.name === table)) {
      warnings.push(`No table or view named "${table}", so the whole schema is shown.`);
      table = '';
    }
    const [result] = db.exec(schemaSql(table));
    const entries = (result?.values ?? []).map((row) => ({
      name: String(row[0] ?? ''),
      type: String(row[1] ?? ''),
      sql: typeof row[2] === 'string' ? row[2] : null,
    }));
    const text = schemaText(entries);
    if (!text) {
      return {
        report: { output: 'This database has no schema to show.', render: 'text' },
        notes,
        warnings,
        stats: summaryStats({ ...context, tableCount: tables.length, sqliteVersion: version }),
      };
    }
    return {
      report: { output: `${text}\n`, render: 'code', language: 'sql' },
      notes,
      warnings,
      stats: summaryStats({ ...context, tableCount: tables.length, sqliteVersion: version }),
    };
  }

  const sql = request.sql.trim();
  if (!sql) {
    notes.unshift('No statement was given, so the table list is shown.');
    return tablesResult(db, tables, context, version, notes, warnings);
  }

  const classified = classifyStatement(sql);
  if (classified.kind !== 'read') {
    const message = refusalMessage(classified);
    throw new ToolError(message ?? 'That is not a readable SQL statement.', READ_ONLY_HINT);
  }

  const [result] = db.exec(classified.sql);
  const columns = result?.columns ?? [];
  const values = result?.values ?? [];
  const limit = Math.max(1, Math.floor(request.maxRows));
  const preview = values.slice(0, limit);

  if (!result) {
    return {
      report: { output: 'The statement returned no result set.', render: 'text' },
      notes,
      warnings,
      stats: summaryStats({
        ...context,
        tableCount: tables.length,
        sqliteVersion: version,
        rowCount: 0,
      }),
    };
  }

  if (values.length > preview.length) {
    notes.push(
      `Showing the first ${formatNumber(preview.length)} of ${formatNumber(values.length)} rows — raise "Rows to show" or export the result.`,
    );
  }

  const exportText =
    request.exportFormat === 'csv'
      ? { contents: toCsv(columns, values), format: 'csv' as const }
      : request.exportFormat === 'json'
        ? { contents: toJson(columns, values), format: 'json' as const }
        : undefined;

  return {
    report: tableReport(columns, preview),
    exportText,
    notes,
    warnings,
    stats: summaryStats({
      ...context,
      tableCount: tables.length,
      sqliteVersion: version,
      rowCount: values.length,
    }),
  };
}
