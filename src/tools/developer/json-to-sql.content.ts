/**
 * Editorial content for the json-to-sql tool page.
 *
 * Kept out of ``json-to-sql.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
