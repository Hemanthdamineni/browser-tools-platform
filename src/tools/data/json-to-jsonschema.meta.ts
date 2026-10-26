import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-jsonschema',
  name: 'JSON to JSON Schema',
  category: 'data',
  summary:
    'Infer a JSON Schema (draft 2020-12) from a JSON sample, with required and additionalProperties control.',
  description:
    'Give a representative JSON value and get back a JSON Schema that describes it. Objects produce properties plus a required list, arrays merge the schema of every element, and primitives map to their type. Everything runs in your browser.',
  keywords: [
    'json to json schema',
    'json schema generator',
    'infer json schema',
    'jsonschema',
    'draft 2020-12',
    'json schema from sample',
    'generate schema',
    'json validation schema',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'title',
      label: 'Schema title',
      type: 'text',
      default: '',
      placeholder: '(none)',
    },
    {
      key: 'requireAllProps',
      label: 'List every object key as required',
      type: 'boolean',
      default: true,
    },
    {
      key: 'additionalProperties',
      label: 'Allow additional properties',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'Object with primitives',
      input: '{"name":"Ann","age":30,"active":true}',
    },
    {
      title: 'Merge an array of objects',
      input: '[{"a":1},{"a":2,"b":"x"}]',
    },
    {
      title: 'Titled, additional properties allowed',
      input: '{"id":1}',
      options: { title: 'Widget', additionalProperties: true },
    },
  ],
  related: ['json-to-typescript', 'json-format', 'json-to-yaml', 'ndjson'],
  status: 'stable',
};
