import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'csv-to-json',
  name: 'CSV to JSON',
  category: 'data',
  summary: 'Parse CSV (RFC 4180) into a JSON array, with delimiter sniffing and type inference.',
  description:
    'Convert delimiter-separated text into a pretty-printed JSON array. Handles quoted fields, escaped quotes, and CRLF or LF line endings. The delimiter can be sniffed automatically, and numbers, booleans, and null can be inferred. Runs on your device.',
  keywords: [
    'csv to json',
    'csv2json',
    'convert csv to json',
    'parse csv',
    'tsv to json',
    'rfc 4180',
    'delimiter',
    'spreadsheet',
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
    {
      key: 'header',
      label: 'First row is a header',
      type: 'boolean',
      default: true,
    },
    {
      key: 'trim',
      label: 'Trim whitespace around fields',
      type: 'boolean',
      default: false,
    },
    {
      key: 'inferTypes',
      label: 'Infer numbers, booleans, and null',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Header row to objects',
      input: 'name,age\nAda,36\nLinus,54\n',
    },
    {
      title: 'Semicolons, keep everything as strings',
      input: 'a;b\n1;2\n',
      options: { delimiter: 'semicolon', inferTypes: false },
    },
    {
      title: 'No header — positional keys',
      input: '1,2,3\n4,5,6\n',
      options: { header: false },
    },
  ],
  faq: [
    {
      q: 'How does auto-detection work?',
      a: 'The first line is scanned for commas, semicolons, tabs, and pipes; whichever appears most often wins, with commas breaking ties.',
    },
    {
      q: 'What keys are used without a header?',
      a: 'Columns are named col1, col2, and so on, based on the widest row.',
    },
    {
      q: 'How are quotes handled?',
      a: 'Fields may be wrapped in double quotes; a doubled "" inside a quoted field becomes a literal quote, per RFC 4180.',
    },
  ],
  related: [  "json-to-csv",
  "yaml-to-json",
  "json-to-yaml"],
  status: 'stable',
};
