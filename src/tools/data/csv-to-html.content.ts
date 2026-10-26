/**
 * Editorial content for the csv-to-html tool page.
 *
 * Kept out of ``csv-to-html.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What comes out',
      body: 'Paste delimited text and the tool emits a self-contained HTML fragment: the first row becomes table header cells, every following row becomes a body row, and each value is HTML-escaped so angle brackets and ampersands cannot turn into markup. It is just the table with no html or body wrapper, ready to drop into a page, an email or a static-site template.',
    },
    {
      heading: 'How the delimiter is applied',
      body: 'The parser uses exactly the separator you choose from comma, tab, semicolon or pipe, and choosing the wrong one collapses every row into a single column. Quoting follows RFC 4180: a quoted field may contain the delimiter and line breaks, and a doubled quote inside it is unescaped to one literal quote.',
    },
    {
      heading: 'Plain or minimal styling',
      body: 'Plain emits a bare table with a thead. Minimal prepends a small style block that adds borders, padding and zebra striping, handy for email bodies, but the rules are not scoped, so several generated tables pasted into one page share them. The stats line reports the data row and column counts.',
    },
    {
      heading: 'Row quirks and privacy',
      body: 'Blank lines are skipped, rows shorter than the widest row are padded with empty cells, and when the header row is narrower than the data the extra columns are titled Column N. There is no row limit on the paste, and the parse, escape and styling all run in the tab with nothing uploaded, so it works offline.',
    },
  ],
  faq: [
    {
      q: 'How does the parser handle quoted fields?',
      a: 'It follows RFC 4180: fields wrapped in double quotes may contain the delimiter and newlines, and doubled quotes inside a field are unescaped.',
    },
    {
      q: 'Is the output safe to embed?',
      a: 'Yes, every cell value is HTML-escaped, so special characters like <, >, and & are never interpreted as markup.',
    },
    {
      q: 'What do the two styles do?',
      a: 'Plain produces a bare <table> with headers in <thead>. Minimal adds a small inline <style> block with borders, padding, and Zebra striping so it looks clean without external CSS.',
    },
    {
      q: 'Can I change the separator?',
      a: 'Yes. Choose from comma, tab, semicolon, or pipe in the delimiter option. The parser detects the field separator exactly as configured.',
    },
  ],
} as const;
