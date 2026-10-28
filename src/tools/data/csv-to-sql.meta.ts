import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'csv-to-sql',
  name: 'CSV to SQL INSERT',
  category: 'data',
  summary:
    'Turn a CSV table into INSERT statements for MySQL, Postgres, SQLite or any SQL database.',
  description:
    'Paste a CSV file and get batched INSERT statements ready to run against any SQL database. Choose the table name, single or double-quoted string literals, NULL sentinels and batch size. Handles quoted fields with embedded commas, new lines and quotes, and detects numbers, strings and NULL values automatically.',
  keywords: [
    'csv to sql',
    'sql insert',
    'csv',
    'insert statements',
    'database seeding',
    'mysql insert',
    'postgres insert',
    'sqlite import',
    'csv importer',
    'sql generator',
    'sql injection escape',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'table',
      label: 'Table name',
      type: 'text',
      default: 'my_table',
      placeholder: 'my_table',
    },
    {
      key: 'header',
      label: 'First row is a header',
      type: 'boolean',
      default: true,
    },
    {
      key: 'quoteStyle',
      label: 'String literal quotes',
      type: 'select',
      default: 'single',
      choices: [
        { value: 'single', label: "Single quotes ('...') — all dialects" },
        { value: 'double', label: 'Double quotes ("...") — MS-SQL' },
      ],
    },
    {
      key: 'mysqlEscapes',
      label: 'MySQL/MariaDB backslash escapes',
      type: 'boolean',
      default: false,
    },
    {
      key: 'nullText',
      label: 'NULL sentinel (matches cell exactly)',
      type: 'text',
      default: 'NULL',
      placeholder: 'NULL',
    },
    {
      key: 'emptyAsNull',
      label: 'Empty cells become NULL',
      type: 'boolean',
      default: true,
    },
    {
      key: 'batch',
      label: 'Rows per INSERT (batch)',
      type: 'number',
      default: 100,
      min: 1,
      step: 1,
    },
  ],
  examples: [
    {
      title: 'Seeding a users table',
      input: 'id,name,email\n1,Ada Lovelace,ada@example.com\n2,Turing,alan@example.com',
      options: { table: 'users', batch: 100 },
    },
    {
      title: 'Quoted fields with commas and quotes',
      input: 'name,note\n"O\'Brien, Tom","said ""hi"""',
      options: { table: 'notes' },
    },
    {
      title: 'NULL values',
      input: 'name,email\nAda,NULL\nTuring,alan@example.com',
      options: { table: 'users', nullText: 'NULL' },
    },
  ],
  faq: [
    {
      q: 'Which databases does this work with?',
      a: 'The output uses standard SQL: INSERT INTO table (columns) VALUES (...), (...); with quoted string literals. It runs on MySQL, PostgreSQL, SQLite, MariaDB, MSSQL (with double-quote literals) and most engines with minor adjustments.',
    },
    {
      q: 'How are strings escaped safely?',
      a: "Embedded quote characters are doubled (the standard SQL escape, e.g. O'Brien), which prevents accidental breaking of the statement and injection-by-CSV. Line breaks inside quoted fields are preserved as \\n escapes.",
    },
    {
      q: 'How does the tool decide numbers vs strings?',
      a: 'A cell that looks like a number and was not quoted in the CSV is emitted as a bare number. Quoted cells, dates and anything else become string literals. Cells equal to the NULL sentinel — or empty when that option is on — become NULL.',
    },
    {
      q: 'What CSV syntax is supported?',
      a: 'RFC 4180: comma-separated, with double-quote quoting for fields containing commas, new lines or quotes, and doubled quotes inside quoted fields. A malformed quote structure raises an error with the position instead of silently mis-splitting rows.',
    },
    {
      q: 'Why batch the INSERTs?',
      a: 'A single giant multi-row INSERT can exceed database statement-size limits. Batching at 100 rows/default keeps each statement well under limits for SQLite and MySQL while staying fast for bulk imports.',
    },
  ],
  related: [  "csv-to-json",
  "json-to-csv",
  "sql-format",
  "csv-sanitize",
  "ndjson"],
  status: 'stable',
};
