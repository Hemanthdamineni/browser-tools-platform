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
  ],
  faq: [
    {
      q: 'How are quoted fields handled?',
      a: 'Fields wrapped in double quotes can contain delimiters, quotes escaped as doubled quotes, and line breaks. Output fields are quoted as needed.',
    },
    {
      q: 'What happens when rows have different lengths?',
      a: 'Short rows are padded with empty fields to the widest row before transposing.',
    },
    {
      q: 'How does auto-detection work?',
      a: 'The first record is checked for comma, semicolon, tab, and pipe separators. The delimiter appearing most often is selected; ties favor comma.',
    },
  ],
  related: [  "csv-to-json",
  "json-to-csv"],
  status: 'stable',
};
