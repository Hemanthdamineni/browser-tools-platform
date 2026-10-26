import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-env',
  name: 'JSON to .env',
  category: 'data',
  summary:
    'Flatten a JSON config into .env lines: VAR__NESTED=value, arrays as JSON, quoting handled.',
  description:
    'Turn a nested JSON configuration into ready-to-paste .env file lines, the way 12-factor configs expect. Top-level keys become uppercase variable names and nested objects join with the Cloud-Run style double underscore (SERVER__HOST=localhost). Strings that need it are quoted, arrays and objects are kept as JSON values, numbers and booleans stay bare, and a sorted option makes diffs easier. Everything runs on your device.',
  keywords: [
    'json to env',
    'json to dotenv',
    'env file generator',
    'nested config to env vars',
    'flat env variables',
    '12 factor env',
    'generate .env from json',
    'env file from config',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'uppercase',
      label: 'Uppercase variable names',
      type: 'boolean',
      default: true,
    },
    {
      key: 'quoteStrings',
      label: 'Quote strings that need it',
      type: 'boolean',
      default: true,
    },
    {
      key: 'separator',
      label: 'Nesting separator',
      type: 'select',
      choices: [
        { value: '__', label: 'Double underscore (SERVER__HOST)' },
        { value: '.', label: 'Dot (SERVER.HOST)' },
        { value: '_', label: 'Single underscore (SERVER_HOST)' },
      ],
      default: '__',
    },
  ],
  examples: [
    {
      title: 'Nested config to env',
      input:
        '{\n  "server": { "host": "localhost", "port": 8080 },\n  "debug": true,\n  "tags": ["a", "b"]\n}',
    },
    {
      title: 'Values that need quoting',
      input: '{\n  "title": "A Site",\n  "note": "line\\nbreak",\n  "empty": null\n}',
    },
    {
      title: 'Dot separator for a Spring-style config',
      input: '{\n  "db": { "url": "postgres://localhost/app", "pool": 10 }\n}',
      options: { separator: '.', uppercase: false },
    },
  ],
  related: ['dotenv', 'json-flatten', 'yaml-to-json', 'properties-convert'],
  status: 'stable',
};
