/**
 * Editorial content for the html-to-csv tool page.
 *
 * Kept out of ``html-to-csv.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Pulling CSV out of table markup',
      body: 'Paste an HTML fragment or a whole page and the tool walks each tr, th and td, strips inner tags, decodes entities such as &amp;, then writes comma-separated output that quotes a field only when it holds a comma, a quote or a line break. The result is plain RFC 4180 CSV that opens straight in Excel, Numbers or Sheets.',
    },
    {
      heading: 'When the data is stuck inside a page',
      body: 'Use it whenever a results table, pricing grid or copied dashboard has no export button and retyping it by hand is not realistic.',
    },
    {
      heading: 'First table or all of them',
      body: 'The tables option exports either just the first table or every table in document order, separated by a blank line. Skipping rows with no cells, on by default, drops padding rows that carry no content.',
    },
    {
      heading: 'Spans, nesting and input size',
      body: 'colspan becomes repeated cells and rowspan pushes placeholders into the following rows so the grid stays rectangular, while a nested table is removed so its rows do not leak into the outer one. Input is limited to 1,000,000 characters, and HTML with no table, or only empty rows, reports a specific error.',
    },
    {
      heading: 'Parsed in the browser, not on a server',
      body: 'The markup you paste is read entirely in the page, so nothing is uploaded and the conversion runs even with the network turned off.',
    },
  ],
  faq: [
    {
      q: 'How are nested tables handled?',
      a: 'Nested tables inside a cell are skipped so their rows do not leak into the outer table; only the table you asked for is exported.',
    },
    {
      q: 'Do rowspan and colspan survive?',
      a: 'colspan shrinks the cell into repeated cells, and rowspan pushes empty placeholders into the following rows so the grid stays rectangular.',
    },
    {
      q: 'What about markup inside a cell?',
      a: 'Tags are stripped and HTML entities (&amp;, &#169;, …) decoded, so “<b>Hi</b> &amp; bye” becomes “Hi & bye”.',
    },
    {
      q: 'What if my HTML has several tables?',
      a: 'Export the first table or all tables in document order, each separated by a blank line. Choose with the option.',
    },
  ],
} as const;
