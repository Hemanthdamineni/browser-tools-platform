/**
 * Editorial content for the xml-to-csv tool page.
 *
 * Kept out of ``xml-to-csv.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'How the records are chosen',
      body: 'Row detection counts same-named children at every depth and takes the element name that occurs most often; with no repetition it falls back to the children of the document element, or to the document element itself. Naming a record path — book, catalog.book or /catalog/book — overrides detection and may be written from the root or relative to the document element.',
    },
    {
      heading: 'How one record becomes one row',
      body: 'A record is flattened into column names and cells. Attributes become @id-style columns, nested elements join with a dot so author.name is one column, and an element holding both children and text keeps its text under its own column name. Values repeated inside one record are written as compact JSON, since a single CSV cell cannot carry the same column twice.',
    },
    {
      heading: 'Delimiters, headers and attributes',
      body: 'delimiter switches between comma, semicolon, tab and pipe, and the chosen character is what triggers quoting. Turning header off removes the first line, and turning includeAttributes off discards every @-column before the header is built. Any cell holding a quote, the delimiter or a line break is quoted, with inner quotes doubled.',
    },
    {
      heading: 'Caps, padding and privacy',
      body: 'Each run accepts up to 2,000,000 characters and 50,000 records; empty input, a document with no tag, or a record path matching nothing is refused instead of emitting an empty file. The header is the union of all columns seen, in first-appearance order, and short rows are padded with empty cells. Comments and processing instructions are skipped rather than validated, so malformed nesting is read as written, and the document is never uploaded.',
    },
  ],
  faq: [
    {
      q: 'How are columns named?',
      a: 'Attributes become @id, @type and so on. Nested elements join with a dot, so <author><name> is the column author.name. When an element holds both attributes and text, the text goes in a column named after the element itself.',
    },
    {
      q: 'What happens when records have different shapes?',
      a: 'The header is the union of every column seen, in first-appearance order. Rows that lack a column are padded with an empty cell.',
    },
    {
      q: 'How are repeated child elements handled?',
      a: 'Values that appear several times inside one record are serialized as compact JSON in that cell, because a single CSV cell cannot repeat a column.',
    },
    {
      q: 'Is the original XML uploaded anywhere?',
      a: 'No. Parsing happens in your browser and no network request is made. Only local files or pasted text are read.',
    },
  ],
} as const;
