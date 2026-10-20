import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'csv-profiler',
  name: 'CSV Profiler',
  category: 'developer',
  summary:
    'Profile a CSV file: per-column type inference, missing values, unique counts, and numeric stats.',
  description:
    'Analyze a CSV or any delimited file to understand its shape: row/column counts, an inferred type for every column (integer, number, boolean, or string), how many values are missing, how many are unique, and min/max/mean for numeric columns. A quick on-device way to validate and clean a dataset before using it.',
  keywords: [
    'csv profiler',
    'data profiling',
    'column statistics',
    'csv analysis',
    'data quality check',
    'missing values',
    'unique values',
    'type inference',
    'csv column stats',
    'dataset inspection',
    'csv summary',
    'numeric stats',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
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
    {
      key: 'parseNumbers',
      label: 'Show numeric stats (min/max/mean)',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Sales dataset',
      input:
        'order_id,product,units,price,note\n1001,Widget,3,9.99,\n1002,Gadget,1,19.50,fig delayed\n1003,Widget,,12.00,',
      options: {},
    },
    {
      title: 'Tab-delimited log',
      input:
        'ts\tlevel\tmsg\n2026-01-01T00:00:00Z\tINFO\tstarted\n2026-01-01T00:00:01Z\tWARN\tflaky',
      options: { delimiter: 'tab' },
    },
  ],
  faq: [
    {
      q: 'How is each column typed?',
      a: 'The profiler looks at the non-empty values in a column. If every value is only true/false it is boolean; integers only it is integer; a mix that parses as finite numbers it is number; otherwise it is string. Empty columns show an empty type.',
    },
    {
      q: 'What counts as a missing value?',
      a: 'A cell whose trimmed content is empty (including a completely empty cell). The header row is not profiled. Missing counts are over the data rows only.',
    },
    {
      q: 'How are min/max/mean computed?',
      a: 'For integer and number columns, from the numeric values after ignoring empty cells. The mean is rounded to two decimals. Toggle parseNumbers off to hide this and keep the report focused on counts.',
    },
    {
      q: 'Does it handle quoted fields and delimiters inside cells?',
      a: 'Yes. The parser follows RFC 4180: fields wrapped in double quotes can contain the delimiter and newlines, and doubled quotes inside a field are unescaped. Rows with fewer fields than the header are padded; extra fields are ignored.',
    },
  ],
  related: ['csv-to-json', 'csv-to-sql', 'csv-sanitize', 'csv-to-markdown', 'json-diff'],
  status: 'stable',
};
