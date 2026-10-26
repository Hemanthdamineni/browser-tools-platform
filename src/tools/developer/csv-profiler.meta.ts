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
    {
      title: 'Pipe-delimited flags',
      input: 'id|name|active\n1|Ada|true\n2|Grace|false',
      options: { delimiter: 'pipe' },
    },
  ],
  related: ['csv-to-json', 'csv-to-sql', 'csv-sanitize', 'csv-to-markdown', 'json-diff'],
  status: 'stable',
};
