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
      max: 1000,
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
  related: ['csv-to-json', 'json-to-csv', 'sql-format', 'csv-sanitize', 'ndjson'],
  status: 'stable',
};
