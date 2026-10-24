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
  ],
  article: [
    {
      heading: 'What it produces',
      body: 'Paste a JSON object and get one .env line per leaf value. Top-level keys become variable names; nested objects are flattened by joining the path with a separator, so {"server":{"host":"x"}} becomes SERVER__HOST=x. Arrays and objects at a leaf stay as single-line JSON, numbers and booleans stay bare, and null becomes an empty value.',
    },
    {
      heading: 'The separator and naming options',
      body: 'The separator changes how a path is joined: __ (SERVER__HOST, the Cloud Run style), . (SERVER.HOST) or _ (SERVER_HOST), so pick whatever your runtime flattens to. Uppercase controls whether the final variable name is capitalised; with it off, keys keep their original case.',
    },
    {
      heading: 'Quoting rules',
      body: 'Quoting is applied only where a plain value would break in a shell: a string containing a space, #, quote, backslash or newline is wrapped in double quotes and escaped, while simple tokens stay bare. Turning quoting off emits every string exactly as typed.',
    },
    {
      heading: 'Limits, errors and privacy',
      body: 'Input is capped at one million characters and nesting at 128 levels, each with a clear error rather than a hang, and the top level must be an object. The flattening is pure string work in this tab with no upload, so configuration that holds credentials stays on your device.',
    },
  ],
  faq: [
    {
      q: 'How are nested objects flattened?',
      a: 'Nested keys join the parent with a double underscore by default, so { "server": { "host": "x" } } becomes SERVER__HOST=x. You can switch the separator to dot or single underscore.',
    },
    {
      q: 'What happens to arrays and objects?',
      a: 'Arrays are kept as JSON on one line (JSON.parse reconstructs them). Objects are flattened with the separator — { "server": { "host": "x" } } becomes SERVER__HOST=x. Null becomes an empty value.',
    },
    {
      q: 'Do strings always get quoted?',
      a: 'Only when they need it — values containing spaces, #, a quote or a newline are wrapped in double quotes with the contents escaped. Plain tokens stay bare so they behave predictably in shells and tools.',
    },
  ],
  related: ['dotenv', 'json-flatten', 'yaml-to-json', 'properties-convert'],
  status: 'stable',
};
