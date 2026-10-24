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
  article: [
    {
      heading: 'Two directions in one box',
      body: 'TOML to JSON parses a configuration file and prints the result pretty-formatted with two-space indentation. JSON to TOML serializes a top-level object back out, emitting scalar assignments first, then nested objects as [section] headers and arrays of objects as repeated [[section]] blocks, so a pyproject.toml or Cargo.toml structure survives the round trip.',
    },
    {
      heading: 'The TOML features the parser understands',
      body: 'Tables, arrays of tables, dotted keys, inline tables, nested arrays, basic, literal and multi-line strings, integers in decimal, hex, octal and binary, floats, booleans and all four date-time flavours are recognized, with comments dropped. Keys that are not bare words are re-quoted on the way back out, and date-time values stay as strings in the JSON.',
    },
    {
      heading: 'When the round trip earns its keep',
      body: 'Convert a hand-maintained netlify.toml into JSON to diff it against a generated config, or flip an API-style JSON fixture into TOML to paste into a repo. Because everything happens locally, you can paste a config that holds credentials or machine paths without worrying about where it goes.',
    },
    {
      heading: 'Nulls and shapes TOML cannot express',
      body: 'TOML has no null, so keys with null values are omitted when serializing and the result reports how many were skipped. A bare JSON scalar or array at the top level cannot become a TOML document, so wrap it in an object first. A JSON array of objects serializes as an array of tables rather than a single array value.',
    },
    {
      heading: 'Conversion stays in the tab',
      body: 'Parsing and serialization both run in the browser on the pasted text, so no document, comment or value is uploaded anywhere. The only trace left behind is the text you paste yourself.',
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
