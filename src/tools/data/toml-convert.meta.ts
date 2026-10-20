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
  ],
  faq: [
    {
      q: 'Is any data uploaded?',
      a: 'No. Parsing and serialization happen inside your browser tab.',
    },
    {
      q: 'Does it support date-time values?',
      a: 'Yes — offset date-times, local date-times, local dates and local times are recognized and kept as their original string form.',
    },
    {
      q: 'What about null in JSON?',
      a: 'TOML has no null. Keys whose value is null are omitted when serializing, and the result reports how many were skipped.',
    },
  ],
  related: ['yaml-to-json', 'json-to-yaml', 'dotenv'],
  status: 'stable',
};
