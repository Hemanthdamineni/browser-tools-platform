import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'csv-to-html',
  name: 'CSV to HTML Table',
  category: 'data',
  summary: 'Turn CSV data into a clean HTML table, with optional inline styling, on device.',
  description:
    'Convert CSV (or other delimited) data into a self-contained HTML <table>. The first row becomes table headers and every following row becomes a table row. Optionally add minimal inline CSS for a tidy, readable table. Great for publishing data in web pages, emails, and Static-site templates.',
  keywords: [
    'csv to html',
    'csv table',
    'html table generator',
    'csv to html table',
    'data table',
    'table converter',
    'html from csv',
    'csv table generator',
    'tabular data',
    'email table',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'style',
      label: 'Table style',
      type: 'select',
      default: 'plain',
      choices: [
        { value: 'plain', label: 'Plain (no styling)' },
        { value: 'minimal', label: 'Minimal inline CSS' },
      ],
    },
    {
      key: 'delimiter',
      label: 'Column delimiter',
      type: 'select',
      default: 'comma',
      choices: [
        { value: 'comma', label: 'Comma (,)' },
        { value: 'tab', label: 'Tab' },
        { value: 'semicolon', label: 'Semicolon (;)' },
        { value: 'pipe', label: 'Pipe (|)' },
      ],
    },
  ],
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
  examples: [
    {
      title: 'Simple table',
      input: 'name,role\nAda,Engineer\nGrace,Navigator',
      options: {},
    },
    {
      title: 'With styling',
      input: 'product,price\nApple,0.5\nOrange,0.75',
      options: { style: 'minimal' },
    },
    {
      title: 'Pipe-delimited data',
      input: 'name|city\nAda|London\nGrace|New York',
      options: { delimiter: 'pipe' },
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
  related: ['csv-to-json', 'csv-to-markdown', 'csv-profiler', 'html-to-text', 'json-diff'],
  status: 'stable',
};
