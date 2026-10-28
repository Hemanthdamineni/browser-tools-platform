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
  summary:
    'Open a .db or .sqlite file in your browser: browse tables, run read-only SQL, export CSV.',
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
  related: ['sql-format', 'csv-profiler', 'spreadsheet-viewer', 'json-format'],
  credits: [sqlJsCredit],
  status: 'stable',
};
