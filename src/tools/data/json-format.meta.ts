import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-format',
  name: 'JSON Formatter & Validator',
  category: 'data',
  summary: 'Pretty-print, minify, recursively sort keys or validate JSON, with line/column errors.',
  description:
    'Parse and reformat JSON entirely in your browser. Pretty-print with 2/4/tab indentation, minify to a single line, recursively sort object keys, or just validate. Syntax errors report the line and column.',
  keywords: [
    'json',
    'json formatter',
    'json beautifier',
    'json validator',
    'pretty print json',
    'minify json',
    'sort json keys',
    'format json',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'operation',
      label: 'Operation',
      type: 'select',
      default: 'pretty',
      choices: [
        { value: 'pretty', label: 'Pretty-print' },
        { value: 'minify', label: 'Minify' },
        { value: 'sort-keys', label: 'Sort keys (recursive)' },
        { value: 'validate', label: 'Validate only' },
      ],
    },
    {
      key: 'indent',
      label: 'Indent',
      type: 'select',
      default: '2',
      choices: [
        { value: '2', label: '2 spaces' },
        { value: '4', label: '4 spaces' },
        { value: 'tab', label: 'Tab' },
      ],
    },
  ],
  examples: [
    { title: 'Pretty-print', input: '{"b":1,"a":[2,3]}', options: { operation: 'pretty' } },
    { title: 'Minify', input: '{\n  "a": 1,\n  "b": 2\n}', options: { operation: 'minify' } },
    {
      title: 'Sort keys recursively',
      input: '{"b":1,"a":{"d":4,"c":3}}',
      options: { operation: 'sort-keys' },
    },
    { title: 'Check a config file', input: '{"port":8080}', options: { operation: 'validate' } },
  ],
  related: ['json-diff', 'ndjson'],
  status: 'stable',
};
