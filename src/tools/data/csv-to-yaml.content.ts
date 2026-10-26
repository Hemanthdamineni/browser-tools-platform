/**
 * Editorial content for the csv-to-yaml tool page.
 *
 * Kept out of ``csv-to-yaml.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the converter writes',
      body: 'Paste a comma, semicolon, tab or pipe separated table and you get back a YAML document made of one list item per row, each item a mapping of keys to values. The first row supplies those keys unless the header option is off, in which case the columns are named column_1, column_2 and so on.',
    },
    {
      heading: 'When a YAML list is the format you want',
      body: 'Reach for this when a spreadsheet has to become configuration rather than code: test fixtures, seed records for a static site, or a small inventory file. Hand-typing indentation for a hundred rows is where typos live, so paste the source rows and let the generator lay out the block.',
    },
    {
      heading: 'Picking the delimiter and header settings',
      body: 'Set the delimiter to match the export, comma by default, with semicolon, tab and pipe also available. Keep First row is the header on so the top line names the keys; turn it off for headerless dumps. Blank or repeated header cells are renamed to safe unique keys such as column_3 and price_2 instead of colliding.',
    },
    {
      heading: 'Typing, quoting and the awkward cases',
      body: 'Unquoted cells that read as integers or decimals become YAML numbers and true or false become booleans, while empty cells become null. Anything you wrapped in quotes in the CSV stays a string, and any value YAML could misread is double-quoted automatically. Cells beyond the last header are kept under _unmapped_ keys rather than dropped.',
    },
    {
      heading: 'Everything happens inside the page',
      body: 'Parsing, type detection and quoting run on your device only. The table is never uploaded, and the converter keeps working with no network connection at all.',
    },
  ],
  faq: [
    {
      q: 'How are cell values typed?',
      a: 'Unquoted cells that look like integers, decimals or true/false become native YAML values; empty cells become null; everything else stays a string. If a cell was quoted in the source CSV it is always kept as a string, and strings that could be misread are double-quoted automatically.',
    },
    {
      q: 'How are headers handled?',
      a: 'With the header option on (default) the first row names the keys. With it off, rows are numbered keys such as row_1. Blank or duplicate header cells are given safe unique names.',
    },
    {
      q: 'What about quoted CSV cells containing commas or newlines?',
      a: 'The parser follows RFC 4180: commas and newlines inside double quotes are part of the cell, and "" is an escaped quote. Such values are emitted as quoted YAML strings that round-trip exactly.',
    },
  ],
} as const;
