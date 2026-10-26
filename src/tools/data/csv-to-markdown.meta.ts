import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'csv-to-markdown',
  name: 'CSV to Markdown Table',
  category: 'data',
  summary:
    'Convert a CSV table into a clean GitHub-Flavored Markdown pipe table with optional alignment.',
  description:
    'Paste a CSV file and get a tidy GFM pipe table you can drop into any Markdown document, issue, or README. Handles quoted fields with embedded commas, new lines and double quotes, escapes literal pipes and newlines inside cells, and can right-align numeric columns automatically. Fully on-device.',
  keywords: [
    'csv to markdown table',
    'csv to md',
    'markdown table generator',
    'gfm table',
    'pipe table',
    'csv renderer',
    'table converter',
    'csv to table',
    'readme table',
    'markdown from csv',
    'csv formatter',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'header', label: 'First row is a header', type: 'boolean', default: true },
    {
      key: 'justify',
      label: 'Column alignment',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Auto (numbers right-aligned)' },
        { value: 'left', label: 'Left-aligned' },
        { value: 'center', label: 'Center-aligned' },
        { value: 'right', label: 'Right-aligned' },
        { value: 'none', label: 'Plain (no alignment row)' },
      ],
    },
  ],
  examples: [
    {
      title: 'Simple CSV with header',
      input: 'Name,Score\nAda,3\nTuring,120',
      options: {},
    },
    {
      title: 'Quoted field containing a comma',
      input: 'Name,Note\n"Smith, John","said ""hi"""',
      options: { justify: 'left' },
    },
    {
      title: 'Plain table with no alignment row',
      input: 'Item,Qty\nBolts,40\nNuts,12',
      options: { header: true, justify: 'none' },
    },
  ],
  related: ['markdown-table', 'csv-to-json', 'csv-to-sql', 'json-to-csv', 'csv-sanitize'],
  status: 'stable',
};
