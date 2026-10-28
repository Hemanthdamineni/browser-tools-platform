import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'yaml-to-json',
  name: 'YAML to JSON',
  category: 'data',
  summary: 'Convert YAML to JSON locally, with indent choice and optional key sorting.',
  description:
    'Parse a YAML document and serialise it as JSON. Choose the indent (2, 4, or tab) and optionally sort object keys alphabetically. Parsing runs entirely on your device.',
  keywords: [
    'yaml to json',
    'yaml2json',
    'convert yaml to json',
    'json',
    'yaml',
    'parse yaml',
    'data format',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
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
    {
      key: 'sortKeys',
      label: 'Sort object keys',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'Mapping to JSON',
      input: 'name: Toolbench\ntags:\n  - a\n  - b\n',
    },
    {
      title: 'Sort keys, tab indent',
      input: 'b: 2\na: 1\n',
      options: { sortKeys: true, indent: 'tab' },
    },
  ],
  faq: [
    {
      q: 'Which YAML version is supported?',
      a: 'YAML 1.2 core schema, including anchors and aliases, via the yaml package. Invalid documents raise a friendly error.',
    },
    {
      q: 'Does sorting recurse into nested objects?',
      a: 'Yes. Every object in the tree has its keys sorted; array order is always preserved.',
    },
  ],
  related: [  "json-to-yaml",
  "csv-to-json",
  "json-to-csv"],
  credits: [{ name: 'yaml', url: 'https://github.com/eemeli/yaml', license: 'ISC' }],
  status: 'stable',
};
