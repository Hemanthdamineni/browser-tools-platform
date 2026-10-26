import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-typescript',
  name: 'JSON to TypeScript',
  category: 'data',
  summary:
    'Generate TypeScript interfaces or type aliases from a JSON sample, with nested named types.',
  description:
    'Paste a JSON value and get TypeScript type declarations for it. Nested objects become their own named types (RootAddress, RootUser), arrays can be merged across every element so missing keys become optional, and null or mixed values turn into unions. Runs entirely on your device.',
  keywords: [
    'json to typescript',
    'json to ts',
    'json to interface',
    'typescript type generator',
    'json to type',
    'infer typescript types',
    'json schema to typescript',
    'quicktype',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'rootName',
      label: 'Root type name',
      type: 'text',
      default: 'Root',
      placeholder: 'Root',
    },
    {
      key: 'preferInterfaces',
      label: 'Use interface (vs type alias)',
      type: 'boolean',
      default: true,
    },
    {
      key: 'readonlyProps',
      label: 'Mark properties readonly',
      type: 'boolean',
      default: false,
    },
    {
      key: 'arrayMergeSampleAll',
      label: 'Merge shape of every array element',
      type: 'boolean',
      default: true,
      help: 'Keys missing from some elements become optional. Off = use the first element only.',
    },
  ],
  examples: [
    {
      title: 'Object with a nested object',
      input: '{"id":1,"name":"Ann","address":{"city":"NYC","zip":null}}',
    },
    {
      title: 'Merge an array of objects',
      input: '{"users":[{"a":1},{"a":2,"b":"x"}]}',
      options: { arrayMergeSampleAll: true },
    },
    {
      title: 'Type alias, readonly',
      input: '{"ok":true,"tags":["a","b"]}',
      options: { preferInterfaces: false, readonlyProps: true },
    },
  ],
  related: ['json-to-jsonschema', 'json-format', 'json-to-yaml', 'yaml-to-json'],
  status: 'stable',
};
