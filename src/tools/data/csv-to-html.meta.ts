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
  related: [  "csv-to-json",
  "csv-to-markdown",
  "csv-profiler",
  "html-to-text",
  "json-diff"],
  status: 'stable',
};
