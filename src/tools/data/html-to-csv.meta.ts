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
  related: ['csv-to-html', 'html-to-text', 'html-to-markdown', 'csv-to-markdown'],
  status: 'stable',
};
