import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id: 'sqlite-viewer',
  name: 'SQLite Viewer',
  category: 'developer',
  summary: 'Open a SQLite database in the browser, browse its tables and run SELECT queries.',
  description:
    'Drop in a .sqlite, .db or .sql file and inspect the schema: tables, columns and row counts at a glance. Run any SELECT query against the data, or export a table or query result as CSV or JSON. The database is opened with sql.js compiled to WebAssembly and never leaves your browser — no uploads, no network, fully offline.',
  keywords: [
    'sqlite viewer',
    'sqlite browser',
    'open sqlite online',
    'db viewer',
    'sqlite query',
    'sqlite to csv',
    'sqlite to json',
    'database viewer',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.sqlite,.db,.sqlite3,.db3,application/vnd.sqlite3,application/x-sqlite3',
  options: [
    {
      key: 'exportFormat',
      label: 'Export format',
      type: 'select',
      help: 'Format used for the result output.',
      choices: [
        { value: 'table', label: 'Interactive table' },
        { value: 'csv', label: 'CSV' },
        { value: 'json', label: 'JSON' },
      ],
      default: 'table',
    },
  ],
  examples: [{ title: 'Inspect a database' }],
  related: [  "csv-to-json",
  "json-to-csv",
  "csv-to-sql",
  "sql-format"],
  credits: [{ name: 'sql.js', url: 'https://sql.js.org/', license: 'MIT' }],
  status: 'beta',
};
