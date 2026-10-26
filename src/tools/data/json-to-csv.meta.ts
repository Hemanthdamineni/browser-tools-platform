import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-csv',
  name: 'JSON to CSV',
  category: 'data',
  summary: 'Turn a JSON array of objects into CSV, with delimiter, header, and flatten options.',
  description:
    'Convert a JSON array of objects (or an array of arrays) into delimiter-separated text. Keys are unioned across every row, nested objects can be flattened to dotted columns, and fields are quoted per RFC 4180. Runs on your device.',
  keywords: [
    'json to csv',
    'json2csv',
    'convert json to csv',
    'csv',
    'tsv',
    'export json',
    'flatten json',
    'spreadsheet',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'delimiter',
      label: 'Delimiter',
      type: 'select',
      default: 'comma',
      choices: [
        { value: 'comma', label: 'Comma ( , )' },
        { value: 'semicolon', label: 'Semicolon ( ; )' },
        { value: 'tab', label: 'Tab' },
        { value: 'pipe', label: 'Pipe ( | )' },
      ],
    },
    {
      key: 'header',
      label: 'Write header row',
      type: 'boolean',
      default: true,
    },
    {
      key: 'flatten',
      label: 'Flatten nested objects to dotted keys',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Array of objects',
      input: '[{ "name": "Ada", "role": "dev" }, { "name": "Linus", "role": "ops" }]',
    },
    {
      title: 'Flatten nested objects',
      input: '[{ "id": 1, "user": { "name": "Ada", "city": "London" } }]',
      options: { flatten: true },
    },
    {
      title: 'Semicolon, no header',
      input: '[{ "a": 1, "b": 2 }]',
      options: { delimiter: 'semicolon', header: false },
    },
  ],
  related: ['csv-to-json', 'json-to-yaml', 'yaml-to-json'],
  status: 'stable',
};
