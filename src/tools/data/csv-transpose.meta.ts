import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'csv-transpose',
  name: 'CSV Transpose',
  category: 'data',
  summary: 'Swap CSV rows and columns while preserving quoted fields.',
  description:
    'Transpose comma-, semicolon-, tab-, or pipe-delimited data by swapping its rows and columns. Quoted fields, embedded delimiters, escaped quotes, and line breaks are preserved. Ragged rows are padded with empty cells. Processing stays on your device.',
  keywords: [
    'csv transpose',
    'transpose csv',
    'swap rows and columns',
    'rotate csv',
    'transpose tsv',
    'spreadsheet',
    'pivot rows columns',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'delimiter',
      label: 'Delimiter',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Auto-detect' },
        { value: 'comma', label: 'Comma ( , )' },
        { value: 'semicolon', label: 'Semicolon ( ; )' },
        { value: 'tab', label: 'Tab' },
        { value: 'pipe', label: 'Pipe ( | )' },
      ],
    },
  ],
  examples: [
    { title: 'Swap rows and columns', input: 'name,age\nAda,36\nLinus,54' },
    {
      title: 'Quoted values and semicolons',
      input: 'item;note\nbook;"paper; bound"',
      options: { delimiter: 'semicolon' },
    },
    { title: 'Rotate a numeric grid', input: '1,2,3\n4,5,6' },
  ],
  related: ['csv-to-json', 'json-to-csv'],
  status: 'stable',
};
