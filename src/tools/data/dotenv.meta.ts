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
  faq: [
    {
      q: 'Which lines are ignored when parsing?',
      a: 'Blank lines and lines whose first non-space character is # are skipped. An "export " prefix is stripped, and matching single or double quotes around a value are removed.',
    },
    {
      q: 'How does ${VAR} expansion work?',
      a: 'With expansion on, ${NAME} in an unquoted or double-quoted value is replaced by the value of an earlier key. Single-quoted values are left literal.',
    },
  ],
  article: [
    {
      heading: 'Two directions, one paste box',
      body: 'The mode option picks the direction. In parse mode the box holds .env text and the tool returns the same keys and values as a pretty JSON object; in build mode the box holds a JSON object and the tool returns ready-to-save .env lines. The input is plain text, so a one-line snippet or a whole multi-line config file works.',
    },
    {
      heading: 'How .env text is normalised',
      body: 'Parsing trims each line, skips blanks and # comments, strips a leading export, and removes a matching pair of quotes. Inside double quotes \\n, \\t, \\r, \\\" and \\\\ are decoded to real characters, and an unquoted value is cut at a space-and-# comment. The JSON output is indented into a stable shape.',
    },
    {
      heading: 'Building .env lines safely',
      body: 'Each JSON value is flattened to a string: null becomes empty, objects and arrays become JSON text, and numbers and booleans stay plain. With the quote option on (the default), a value containing a space, #, quote or backslash is wrapped in double quotes with its contents escaped.',
    },
    {
      heading: 'Expansion is opt-in and local',
      body: 'Expansion replaces ${NAME} in unquoted and double-quoted values with the value of an earlier key, leaves single-quoted text literal, and turns unknown references into empty strings, which is why it is off by default. Parsing and building both run in this tab with nothing uploaded, so variables that are often secrets stay on your device.',
    },
  ],
  related: ['querystring', 'json-format', 'json-to-yaml', 'yaml-to-json'],
  status: 'stable',
};
