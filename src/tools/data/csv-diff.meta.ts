import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'csv-diff',
  name: 'CSV Diff',
  category: 'data',
  summary: 'Compare two CSV files keyed by a column: added, removed and changed cells.',
  description:
    'Diff two CSV documents row by row using a key column, and see exactly what changed: rows added, rows removed, column changes, and per-cell value changes with old and new text. Header changes and duplicate keys are reported as issues. Quote-aware parsing follows RFC 4180, and everything runs on-device with no upload.',
  keywords: [
    'csv diff',
    'compare csv',
    'csv compare',
    'diff two csv',
    'csv changes',
    'csv delta',
    'spreadsheet diff',
    'row compare',
    'csv key compare',
    'csv difference',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'second',
      label: 'Second CSV (B)',
      type: 'textarea',
      default: '',
      placeholder: 'id,name\n1,Alice',
    },
    {
      key: 'keyColumn',
      label: 'Key column',
      type: 'text',
      default: 'id',
      placeholder: 'id',
    },
    {
      key: 'delimiter',
      label: 'Delimiter',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Auto-detect' },
        { value: ',', label: 'Comma' },
        { value: ';', label: 'Semicolon' },
        { value: '\t', label: 'Tab' },
        { value: '|', label: 'Pipe' },
      ],
    },
  ],
  examples: [
    {
      title: 'One changed value',
      input: 'id,name,city\n1,Alice,Berlin\n2,Bob,Paris',
      options: { second: 'id,name,city\n1,Alice,Berlin\n2,Bob,Lyon' },
    },
    {
      title: 'Added and removed rows',
      input: 'id,name\n1,Alice\n2,Bob',
      options: { second: 'id,name\n2,Bob\n3,Cara' },
    },
    {
      title: 'Semicolon export keyed by SKU',
      input: 'sku;qty\nA1;3\nA2;5',
      options: { second: 'sku;qty\nA1;4\nA2;5', keyColumn: 'sku', delimiter: ';' },
    },
  ],
  related: ['csv-profiler', 'json-diff', 'csv-to-json', 'csv-sanitize', 'csv-to-markdown'],
  status: 'stable',
};
