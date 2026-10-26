import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'dotenv',
  name: '.env <-> JSON',
  category: 'data',
  summary:
    'Parse a .env file into JSON, or turn a JSON object into .env text. Runs entirely on your device.',
  description:
    'Convert KEY=VALUE lines from a .env file into a pretty JSON object, or serialise a JSON object back into .env text. Comments, blank lines, an "export " prefix and surrounding quotes are handled, with optional ${VAR} expansion.',
  keywords: [
    'dotenv',
    '.env',
    'env file',
    'environment variables',
    'env to json',
    'json to env',
    'parse dotenv',
    'config',
    'twelve factor',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'parse',
      choices: [
        { value: 'parse', label: '.env -> JSON' },
        { value: 'build', label: 'JSON -> .env' },
      ],
    },
    {
      key: 'quoteValues',
      label: 'Quote values with spaces or specials',
      type: 'boolean',
      default: true,
      showWhen: { key: 'mode', value: 'build' },
    },
    {
      key: 'expand',
      label: 'Expand ${VAR} references',
      type: 'boolean',
      default: false,
      showWhen: { key: 'mode', value: 'parse' },
    },
  ],
  examples: [
    {
      title: 'Parse a .env file',
      input: '# database\nexport DB_HOST=localhost\nDB_PORT=5432\nGREETING="hello world"',
      options: { mode: 'parse' },
    },
    {
      title: 'Parse with variable expansion',
      input: 'HOST=localhost\nPORT=5432\nURL=postgres://${HOST}:${PORT}/app',
      options: { mode: 'parse', expand: true },
    },
    {
      title: 'Build .env from JSON',
      input: '{ "DB_HOST": "localhost", "GREETING": "hello world" }',
      options: { mode: 'build' },
    },
  ],
  related: ['querystring', 'json-format', 'json-to-yaml', 'yaml-to-json'],
  status: 'stable',
};
