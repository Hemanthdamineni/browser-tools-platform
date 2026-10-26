import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-sql',
  name: 'JSON to SQL',
  category: 'developer',
  summary:
    'Turn a JSON array of objects into SQL INSERT statements with correct types and escaping.',
  description:
    'Convert a JSON array of flat objects into portable SQL INSERT statements. Keys become columns (union of all objects, first-seen order), and values are typed and escaped correctly: strings are single-quoted with doubled apostrophes, NULLs stay NULL, numbers and booleans are emitted bare (booleans as 1/0 for portability), and nested objects or arrays are serialised as JSON strings. Choose the table name and optionally emit CREATE TABLE or wrap the inserts in a transaction.',
  keywords: [
    'json to sql',
    'json to insert',
    'sql insert generator',
    'json to database',
    'convert json to sql',
    'sql insert statements',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'table',
      label: 'Table name',
      type: 'text',
      default: 'my_table',
      placeholder: 'users',
    },
    {
      key: 'dialect',
      label: 'Dialect',
      type: 'select',
      choices: [
        { value: 'standard', label: 'Standard (PostgreSQL/MySQL/SQLite)' },
        { value: 'mysql', label: 'MySQL (backtick identifiers)' },
      ],
      default: 'standard',
    },
    {
      key: 'includeCreate',
      label: 'Emit CREATE TABLE',
      type: 'boolean',
      default: false,
    },
    {
      key: 'transaction',
      label: 'Wrap in a transaction',
      type: 'boolean',
      default: true,
    },
    {
      key: 'multiRow',
      label: 'One INSERT with multiple VALUES rows',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'Users array',
      input: '[{"id":1,"name":"Ada","active":true}]',
      options: { table: 'users' },
    },
    {
      title: 'CREATE TABLE plus a transaction',
      input: '[{"id":1,"email":"a@example.com"},{"id":2,"email":"b@example.com"}]',
      options: { table: 'accounts', includeCreate: true, transaction: true },
    },
    {
      title: 'MySQL dialect, single multi-row INSERT',
      input: '[{"sku":"A1","qty":3},{"sku":"B2","qty":7}]',
      options: { table: 'stock', dialect: 'mysql', multiRow: true },
    },
  ],
  related: ['csv-to-sql', 'json-to-csv', 'sql-format', 'json-to-yaml'],
  status: 'stable',
};
