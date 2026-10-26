import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'toml-convert',
  name: 'TOML ⇄ JSON Converter',
  category: 'data',
  summary: 'Parse TOML into JSON, or serialize JSON back to TOML.',
  description:
    'Convert TOML configuration files (pyproject.toml, Cargo.toml, netlify.toml) into JSON and back. The parser understands tables, arrays of tables, dotted keys, inline tables, nested arrays, basic/literal/multi-line strings, integers in all bases, floats, booleans and date-time values, plus comments. Everything runs on-device with no uploads.',
  keywords: [
    'TOML',
    'TOML to JSON',
    'JSON to TOML',
    'pyproject',
    'Cargo.toml',
    'config converter',
    'parse toml',
    'toml parser',
    'netlify.toml',
    'toml serializer',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'to-json',
      choices: [
        { value: 'to-json', label: 'TOML → JSON' },
        { value: 'to-toml', label: 'JSON → TOML' },
      ],
    },
  ],
  examples: [
    {
      title: 'TOML to JSON',
      input: '[server]\nhost = "localhost"\nport = 8080\n\n[[items]]\nname = "a"',
    },
    {
      title: 'JSON to TOML',
      input: '{"server":{"host":"localhost","port":8080}}',
      options: { mode: 'to-toml' },
    },
    {
      title: 'Arrays of tables both ways',
      input: '{"products":[{"name":"bolt","price":0.5},{"name":"nut","price":0.2}]}',
      options: { mode: 'to-toml' },
    },
  ],
  related: ['yaml-to-json', 'json-to-yaml', 'dotenv'],
  status: 'stable',
};
