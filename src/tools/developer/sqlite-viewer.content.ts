/**
 * Editorial content for the sqlite-viewer tool page.
 *
 * Kept out of ``sqlite-viewer.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
