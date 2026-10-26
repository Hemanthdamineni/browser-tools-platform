/**
 * Editorial content for the csv-to-sql tool page.
 *
 * Kept out of ``csv-to-sql.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'From pasted CSV to runnable INSERTs',
      body: 'Paste a CSV table and get INSERT INTO table (columns) VALUES (...), (...); statements batched to the row count you choose. Fields may be quoted with embedded commas, line breaks and doubled quotes, following RFC 4180. Unquoted cells that look numeric become bare numbers and everything else a quoted string literal; the stats count rows, columns and statements.',
    },
    {
      heading: 'The migration moment this is for',
      body: 'It suits the times you have a spreadsheet export and a database to seed: a fixtures file for a test suite, a reference table for staging, or a one-off load where wiring up a client library would take longer than the import itself.',
    },
    {
      heading: 'Options that change the statement',
      body: 'Table name and the First row is a header switch decide the column list; without a header the columns become col1, col2 and so on. String literal quotes toggles between single quotes for most dialects and double quotes for MS-SQL. The NULL sentinel is matched exactly, Empty cells become NULL handles blanks, and MySQL backslash escapes adds the escaping MySQL expects.',
    },
    {
      heading: 'Validation happens before generation',
      body: "Table and column names must be valid identifiers, duplicate headers are rejected, every data row must hold as many cells as the header, and an unterminated quoted field is reported with its line number. Quote characters inside values are doubled, so a value such as O'Brien cannot break out of its literal.",
    },
    {
      heading: 'Your data stays where it is',
      body: 'Parsing and statement generation run entirely in this tab; the CSV is never uploaded and no SQL is executed. You can turn a dump of customer records into INSERTs with no network at all.',
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
} as const;
