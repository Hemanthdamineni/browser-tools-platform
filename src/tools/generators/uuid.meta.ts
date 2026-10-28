import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'uuid',
  name: 'UUID Generator',
  category: 'generators',
  summary: 'Generate RFC 4122 UUIDs (v4 random or v7 time-ordered) in bulk.',
  description:
    'Create one or many UUIDs. Version 4 is fully random; version 7 embeds a millisecond timestamp so IDs sort chronologically. All bytes come from your browser’s CSPRNG.',
  keywords: ['uuid', 'guid', 'v4', 'v7', 'unique id', 'identifier', 'rfc 4122', 'random'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'version',
      label: 'Version',
      type: 'select',
      default: 'v4',
      choices: [
        { value: 'v4', label: 'v4 — random' },
        { value: 'v7', label: 'v7 — time-ordered' },
        { value: 'nil', label: 'Nil UUID' },
      ],
    },
    { key: 'count', label: 'How many', type: 'number', default: 1, min: 1 },
    { key: 'uppercase', label: 'Uppercase', type: 'boolean', default: false },
    { key: 'braces', label: 'Wrap in { }', type: 'boolean', default: false },
    { key: 'hyphens', label: 'Include hyphens', type: 'boolean', default: true },
  ],
  examples: [
    { title: 'One v4', options: { version: 'v4', count: 1 } },
    { title: '10 × v7 (sortable)', options: { version: 'v7', count: 10 } },
  ],
  faq: [
    {
      q: 'Are these cryptographically random?',
      a: 'The random bits use crypto.getRandomValues, the browser CSPRNG. v7 also mixes in the current time so values are ordered.',
    },
    {
      q: 'When should I use v7 instead of v4?',
      a: 'v7 sorts by creation time, which keeps database indexes tighter and makes logs easier to scan. Use v4 when you want no time information leaked.',
    },
  ],
  related: [  "nanoid",
  "ulid",
  "random-string",
  "password"],
  status: 'stable',
};
