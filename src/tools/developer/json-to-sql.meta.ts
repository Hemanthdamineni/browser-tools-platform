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
  article: [
    {
      heading: 'From JSON array to INSERT statements',
      body: 'Paste a JSON array of flat objects and the tool writes one SQL INSERT per object (or a single multi-row INSERT), plus an optional CREATE TABLE. The keys of your objects become the columns — the union of every key, kept in the order they were first seen — so rows that omit a key simply get NULL in that column and the statements stay aligned across all rows. Identifiers are quoted and strings escaped so the SQL copy-pastes without hand-fixing.',
    },
    {
      heading: 'When this beats hand-writing SQL',
      body: 'Loading a small fixture into a test database, seeding a demo, or moving an API response into a table are the classic cases. Generation is deterministic and types are inferred, so you avoid the usual mistakes — a missing apostrophe escape, mismatched column counts between rows, or a boolean written as "true" where Postgres wants true or MySQL wants 1.',
    },
    {
      heading: 'Options and what they change',
      body: 'Table sets the target name and must be a plain identifier. Dialect switches between standard double-quoted identifiers and MySQL backtick quoting. Emit CREATE TABLE adds a table definition with a type inferred per column from the values it saw. One INSERT with multiple VALUES rows collapses everything into a single statement, and the transaction switch wraps the output in BEGIN; and COMMIT; (on by default).',
    },
    {
      heading: 'How values are written',
      body: 'Strings are single-quoted with internal apostrophes doubled, which is valid across PostgreSQL, MySQL and SQLite. Numbers and booleans are emitted bare, with booleans as 1 or 0 for portability. null becomes NULL. Nested objects and arrays have no SQL column equivalent here, so they are serialised as JSON strings in the cell rather than silently flattened.',
    },
    {
      heading: 'Your data is not sent anywhere',
      body: 'The array is parsed and the statements are generated locally in this tab. Nothing is uploaded and no database is contacted, which is what makes it safe to turn a private export into insert statements here.',
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
  faq: [
    {
      q: 'How are values escaped?',
      a: "Single quotes in strings are doubled ('O''Brien'), which is valid across PostgreSQL, MySQL and SQLite. Nested objects and arrays are emitted as JSON strings; null stays NULL; booleans become 1/0.",
    },
    {
      q: 'What if objects have different keys?',
      a: 'Columns are the union of all keys in first-seen order. Rows missing a key emit NULL for that column, so the generated INSERTs stay aligned.',
    },
    {
      q: 'Which SQL dialect?',
      a: 'Standard quoting works for PostgreSQL, SQLite and MySQL. Pick the MySQL option if you prefer backtick-quoted identifiers.',
    },
  ],
  related: ['csv-to-sql', 'json-to-csv', 'sql-format', 'json-to-yaml'],
  status: 'stable',
};
