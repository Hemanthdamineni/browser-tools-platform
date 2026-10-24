import type { ToolMeta } from '@/lib/types';

/** sql.js is SQLite compiled to WebAssembly; it runs in this tab, never on a server. */
const sqlJsCredit = {
  name: 'sql.js',
  url: 'https://github.com/sql-js/sql.js',
  license: 'MIT',
};

export const meta: ToolMeta = {
  id: 'sqlite-viewer',
  name: 'SQLite Viewer',
  category: 'developer',
  summary: 'Open a .db or .sqlite file in your browser: browse tables, run read-only SQL, export CSV.',
  description:
    'Inspect a SQLite database without installing anything: open the file, see every table with its column and row counts, dump the CREATE statements, and query the data. Results export as CSV or JSON, and every statement is checked before it runs, so nothing can change the database.',
  keywords: [
    'sqlite viewer',
    'open sqlite file',
    'sqlite browser',
    'db file viewer',
    'sqlite online',
    'sql.js',
    'read sqlite',
    'sqlite schema',
    'export sqlite to csv',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.db,.sqlite,.sqlite3,.db3',
  // Browsing tables, dumping the schema and running a statement is a flow the
  // generic option form cannot express, so the tool opts into its own panel
  // (src/components/panels/sqlite-viewer.astro). The options below are what the
  // panel drives; they are read by `run()` through `resolveOptions`, so the
  // tool stays usable without the UI.
  panel: 'sqlite-viewer',
  options: [
    {
      key: 'action',
      label: 'Show',
      type: 'select',
      default: 'browse',
      choices: [
        { value: 'browse', label: 'Tables and summary' },
        { value: 'schema', label: 'Schema (CREATE statements)' },
        { value: 'query', label: 'Run a statement' },
      ],
    },
    {
      key: 'query',
      label: 'SQL statement',
      type: 'textarea',
      default: '',
      placeholder: 'SELECT * FROM users LIMIT 50;',
      help: 'One read-only statement: SELECT, WITH, VALUES, TABLE, EXPLAIN, a metadata PRAGMA, .tables or .schema. Writes are refused.',
    },
    {
      key: 'table',
      label: 'Table for the schema',
      type: 'text',
      default: '',
      placeholder: 'users',
      help: 'Leave empty to dump the whole schema.',
    },
    {
      key: 'export',
      label: 'Export the result',
      type: 'select',
      default: 'none',
      choices: [
        { value: 'none', label: 'Do not export' },
        { value: 'csv', label: 'CSV file' },
        { value: 'json', label: 'JSON file' },
      ],
    },
    {
      key: 'maxRows',
      label: 'Rows to show',
      type: 'number',
      default: 500,
      min: 1,
      max: 100000,
      help: 'Only the preview is capped. An export always contains every row the statement returned.',
    },
  ],
  examples: [
    { title: 'List every table', options: { action: 'browse' } },
    { title: 'Show the schema', options: { action: 'schema' } },
    {
      title: 'Browse 100 rows',
      options: { action: 'query', query: 'SELECT * FROM sqlite_master LIMIT 100;', maxRows: 100 },
    },
    {
      title: 'Export the table list as CSV',
      options: { action: 'query', query: 'SELECT name, type FROM sqlite_master;', export: 'csv' },
    },
  ],
  faq: [
    {
      q: 'Is my database uploaded anywhere?',
      a: 'No. The file is read from your disk into this tab and opened with sql.js, a WebAssembly build of SQLite that runs in a background worker. Nothing is sent to a server, and the tool keeps working offline.',
    },
    {
      q: 'Can I edit rows or change the schema?',
      a: 'No, and that is deliberate. INSERT, UPDATE, DELETE, REPLACE, CREATE, DROP, ALTER, ATTACH, DETACH, VACUUM and transaction statements are all refused before they reach the engine, and PRAGMAs that write are refused too. Use a desktop SQLite client to make changes.',
    },
    {
      q: 'Which statements can I run?',
      a: 'SELECT, WITH … SELECT, VALUES, TABLE, EXPLAIN, the metadata PRAGMAs (table_info, index_list, database_list and friends), and the .tables and .schema shortcuts. One statement per run, so a second statement after a semicolon is rejected.',
    },
    {
      q: 'How large a database can it open?',
      a: 'Up to 200 MB. The whole file is held in memory while you browse, so very large databases may be better served by a desktop tool or by exporting a subset with the sqlite3 command line first.',
    },
  ],
  article: [
    {
      heading: 'Opening a database without a server',
      body: 'Choose a .db, .sqlite, .sqlite3 or .db3 file and the viewer reads its bytes into a background worker, where sql.js — SQLite compiled to WebAssembly — opens a copy. The file itself is only ever read: the copy lives in memory for one run and is then discarded, so the file on disk is never modified and nothing is uploaded.',
    },
    {
      heading: 'Read-only by construction',
      body: 'SQL is not executed blindly. Every statement is scanned first — strings, quoted identifiers and comments are masked out — then classified against a whitelist. SELECT, WITH … SELECT, VALUES, TABLE, EXPLAIN and a set of metadata PRAGMAs are allowed; everything else is refused with the reason. That also catches a read that hides a write, such as a CTE ending in INSERT, and input holding more than one statement.',
    },
    {
      heading: 'Browsing, querying, exporting',
      body: 'The table list shows each table or view with its column and row count, and clicking a name runs a bounded SELECT for you. From there, write your own statement, raise the row limit, and export the full result set as RFC 4180 CSV or JSON — an array of objects keyed by column, with BLOBs base64-encoded. The preview is capped to keep the page responsive; the export is not.',
    },
    {
      heading: 'How the schema dump works',
      body: 'The schema view reads sqlite_master, so it shows the exact CREATE TABLE, CREATE VIEW, CREATE INDEX and CREATE TRIGGER statements the database stores, in one copy-pasteable script. Point it at a single table to see only that table and the indexes and triggers that belong to it.',
    },
  ],
  related: ['sql-format', 'csv-profiler', 'spreadsheet-viewer', 'json-format'],
  credits: [sqlJsCredit],
  status: 'stable',
};
