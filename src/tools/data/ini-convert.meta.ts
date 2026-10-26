import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'ini-convert',
  name: 'INI Converter',
  category: 'data',
  summary: 'Convert INI config files to JSON or serialize JSON back to INI, on device.',
  description:
    'Move configuration between INI syntax and JSON. Parse INI into a nested JSON object (sections become objects, values are typed as booleans, integers, floats, or strings), or generate standard INI from JSON with sections, dotted nested sections, and repeated dotted keys for arrays. Great for editing .ini, .cfg and similar config files in a structured editor.',
  keywords: [
    'ini to json',
    'json to ini',
    'ini converter',
    'ini parser',
    'ini config',
    'config file converter',
    'ini format',
    'ini sections',
    'ini to json converter',
    'php ini',
    'cfg file',
    'windows ini',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'ini-to-json',
      choices: [
        { value: 'ini-to-json', label: 'INI → JSON' },
        { value: 'json-to-ini', label: 'JSON → INI' },
      ],
    },
  ],
  examples: [
    {
      title: 'Parse an INI file',
      input: 'port = 8080\nlog_level = debug\n\n[database]\nhost = localhost\nssl = true',
      options: {},
    },
    {
      title: 'Generate INI from JSON',
      input: '{"app":{"name":"demo","debug":false},"server":{"port":8080}}',
      options: { mode: 'json-to-ini' },
    },
    {
      title: 'Nested JSON to dotted sections',
      input: '{"app":{"database":{"host":"db1","port":5432}}}',
      options: { mode: 'json-to-ini' },
    },
  ],
  related: ['toml-convert', 'yaml-to-json', 'json-to-yaml', 'dotenv', 'json-diff'],
  status: 'stable',
};
