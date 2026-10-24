import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'html-to-csv',
  name: 'HTML Table to CSV',
  category: 'data',
  summary: 'Extract <table> elements from pasted HTML and output clean, RFC-4180 CSV.',
  description:
    'Pull tables out of an HTML fragment or document: every <tr>/<th>/<td> becomes a CSV row with quoted fields, entity references decoded and embedded markup stripped. Handles rowspan and colspan by padding cells, skips nested tables, and can output just the first table or all of them. The inverse of csv-to-html. 100% on-device.',
  keywords: [
    'html table to csv',
    'extract table from html',
    'html to csv converter',
    'scrape table csv',
    'html table extractor',
    'parse html table',
    'table to csv',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Tables to export',
      type: 'select',
      choices: [
        { value: 'first', label: 'First table only' },
        { value: 'all', label: 'All tables' },
      ],
      default: 'first',
    },
    {
      key: 'skipEmptyRows',
      label: 'Skip rows with no cells',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'A simple HTML table',
      input: '<table><tr><th>Name</th><th>Score</th></tr><tr><td>Ada</td><td>98</td></tr></table>',
    },
    {
      title: 'Export every table on the page',
      input: '<table><tr><td>a</td></tr></table>\n<table><tr><td>b</td></tr></table>',
      options: { mode: 'all' },
    },
    {
      title: 'Keep sparse rows',
      input: '<table><tr><th>H</th></tr><tr><td></td></tr></table>',
      options: { skipEmptyRows: false },
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
  related: ['csv-to-html', 'html-to-text', 'html-to-markdown', 'csv-to-markdown'],
  status: 'stable',
};
