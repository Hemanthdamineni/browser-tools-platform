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
  article: [
    {
      heading: 'What comes out',
      body: 'Paste delimiter-separated text and you get a pretty-printed JSON array of objects, one per data row, keyed by the header names. With the header toggle off, the first row is treated as data and columns are keyed col1, col2 and so on, sized to the widest row. The output is ordinary JSON you can drop into an API request or a script.',
    },
    {
      heading: 'Real CSV rules are handled',
      body: 'The parser follows RFC 4180: fields may be wrapped in double quotes, a doubled "" inside a quoted field becomes one literal quote, and quoted fields can contain the delimiter and newlines. Both CRLF and LF line endings, and a single trailing newline, are handled without producing a phantom empty row. An unterminated quote is reported as an error rather than swallowed.',
    },
    {
      heading: 'Options that change the result',
      body: 'Delimiter chooses comma, semicolon, tab or pipe, or Auto-detect, which scans the first line and picks whichever separator appears most often (commas break ties). “First row is a header” decides whether row one labels the keys. Trim strips whitespace around fields. Infer numbers, booleans and null decides whether text like 42, true or null becomes a JSON number, boolean or null instead of a string.',
    },
    {
      heading: 'Caveats and privacy',
      body: 'Type inference only converts a number when it round-trips exactly, so a value like 007 stays the string “007” and leading zeros survive. Widely ragged rows are padded with empty values rather than rejected. Everything runs in the page — the text is parsed locally with no upload and no network call, and the same result is produced offline.',
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
    {
      title: 'Quoted fields with commas and quotes',
      input: '"name","quote"\n"Doe, John","She said ""hi"""\n',
      options: { header: true },
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
    {
      q: 'Will a number like 007 lose its leading zero?',
      a: 'No. A value is only converted to a JSON number when the number round-trips back to exactly the same text, so 007 stays the string "007".',
    },
  ],
  related: ['json-to-csv', 'yaml-to-json', 'json-to-yaml'],
  status: 'stable',
};
