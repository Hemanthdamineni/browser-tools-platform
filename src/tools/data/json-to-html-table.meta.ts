import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-html-table',
  name: 'JSON to HTML Table',
  category: 'data',
  summary: 'Render a JSON array into an HTML table of rows and columns, with multi-level headers.',
  description:
    'Paste a JSON array of objects or an array of arrays and get a clean HTML <table>: one header row from the object keys (or the array values), one row per record, escaped cell text so the markup stays valid. Nested objects and arrays inside a cell are rendered as readable JSON, and null, booleans and numbers keep their JSON type so nothing is lossy. Works entirely on your device.',
  keywords: [
    'json to html table',
    'render json as table',
    'json table',
    'json to html',
    'table from json array',
    'json to grid',
    'export json to html table',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'theme',
      label: 'Style',
      type: 'select',
      choices: [
        { value: 'plain', label: 'Plain (no classes)' },
        { value: 'zebra', label: 'Zebra stripes' },
        { value: 'bordered', label: 'Bordered' },
      ],
      default: 'plain',
    },
    {
      key: 'nestedCells',
      label: 'Pretty-print nested values in cells',
      type: 'boolean',
      default: true,
    },
    {
      key: 'escape',
      label: 'Escape cell text',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Rows from objects',
      input:
        '[ { "name": "Ada", "role": "Admin", "active": true }, { "name": "Lin", "role": "Editor", "active": false } ]',
    },
    {
      title: 'Rows from arrays of arrays',
      input: '[[1, 2, 3], [4, 5, 6], [7, 8, 9]]',
    },
    {
      title: 'Zebra table with compact nested values',
      input: '[ { "id": 1, "tags": ["a", "b"] } ]',
      options: { theme: 'zebra', nestedCells: false },
    },
  ],
  related: ['csv-to-html', 'json-format', 'csv-to-json', 'csv-profiler'],
  status: 'stable',
};
