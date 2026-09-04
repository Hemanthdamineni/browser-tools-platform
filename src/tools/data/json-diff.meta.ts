import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-diff',
  name: 'JSON Diff',
  category: 'data',
  summary:
    'Structural diff of two JSON documents, showing added, removed and changed values by path.',
  description:
    'Compare two JSON documents key by key and value by value. The result is a diff listing every path that was added, removed or changed, with the value from each side. Everything runs locally.',
  keywords: [
    'json diff',
    'compare json',
    'json compare',
    'structural diff',
    'object diff',
    'json delta',
    'diff two json',
    'json changes',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'second',
      label: 'Second JSON (B)',
      type: 'textarea',
      default: '{}',
      placeholder: '{ "b": 2 }',
    },
    {
      key: 'ignoreArrayOrder',
      label: 'Ignore array order',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'Changed and added keys',
      input: '{ "name": "a", "port": 80 }',
      options: { second: '{ "name": "a", "port": 443, "tls": true }' },
    },
    {
      title: 'Nested object diff',
      input: '{ "db": { "host": "localhost", "port": 5432 } }',
      options: { second: '{ "db": { "host": "127.0.0.1", "port": 5432 } }' },
    },
    {
      title: 'Ignore array order',
      input: '{ "tags": ["a", "b", "c"] }',
      options: { second: '{ "tags": ["c", "b", "a"] }', ignoreArrayOrder: true },
    },
  ],
  faq: [
    {
      q: 'What do the +/- lines mean?',
      a: 'A line starting with - is the value only in A (removed); a line starting with + is the value only in B (added). A changed value shows both a - and a + line for the same path.',
    },
    {
      q: 'How does "ignore array order" work?',
      a: 'Arrays are compared as multisets: an element present in both sides in equal counts is treated as unchanged regardless of position. Otherwise arrays are compared index by index.',
    },
  ],
  related: ['json-format', 'json-to-yaml', 'querystring', 'ndjson'],
  status: 'stable',
};
