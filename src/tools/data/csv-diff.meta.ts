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
  ],
  faq: [
    {
      q: 'How are rows matched between the two files?',
      a: 'By the value of the key column you choose (default "id"). Every row is identified by that cell, so rows may be in any order and still match.',
    },
    {
      q: 'What if the two files have different columns?',
      a: 'Separate entries report columns only present in A or only in B, and each shared column is still compared cell by cell. The key column is excluded from value comparison.',
    },
    {
      q: 'Are duplicate keys reported?',
      a: 'Yes. If a key appears more than once in the same file, that is reported as a duplicate-key issue; the last occurrence is used for comparison.',
    },
    {
      q: 'How is the delimiter chosen?',
      a: 'Auto-detect counts comma, semicolon, tab and pipe characters in the first lines and picks the most frequent. You can also force one from the dropdown.',
    },
  ],
  related: ['csv-profiler', 'json-diff', 'csv-to-json', 'csv-sanitize', 'csv-to-markdown'],
  status: 'stable',
};
