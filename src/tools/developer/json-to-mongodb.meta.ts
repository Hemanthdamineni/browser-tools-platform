import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-mongodb',
  name: 'JSON to MongoDB',
  category: 'developer',
  summary:
    'Wrap JSON documents in a mongosh insertMany script for a collection, exactly as BSON-ready documents.',
  description:
    'Turn a JSON array (or single object) into a ready-to-run mongosh command: db.<collection>.insertMany([...]);. JSON is embedded verbatim as JavaScript object literals so exact types survive — no quoting surprises. Choose compact or pretty formatting, toggle the wrapper, and pick your collection name.',
  keywords: [
    'json to mongodb',
    'mongosh insertMany',
    'json to mongosh',
    'insert documents mongo',
    'mongodb insert script',
    'json to mongo documents',
    'collection insert',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'collection',
      label: 'Collection name',
      type: 'text',
      default: 'items',
      placeholder: 'users',
    },
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      choices: [
        { value: 'pretty', label: 'Pretty (multi-line)' },
        { value: 'compact', label: 'Compact (one line)' },
      ],
      default: 'pretty',
    },
    {
      key: 'wrapped',
      label: 'Wrap in db.collection.insertMany script',
      type: 'boolean',
      default: true,
    },
    {
      key: 'indentSpaces',
      label: 'Indent width (spaces)',
      type: 'number',
      default: 2,
      min: 0,
      max: 8,
    },
  ],
  examples: [
    {
      title: 'A users collection',
      input:
        '[{"name":"Ada","role":"admin","active":true},{"name":"Lin","role":"dev","active":false}]',
      options: { collection: 'users' },
    },
    {
      title: 'A single document',
      input: '{"sku":"A-1","stock":12}',
      options: { collection: 'products' },
    },
    {
      title: 'Compact output without the wrapper',
      input: '[{"a":1},{"a":2}]',
      options: { collection: 'items', format: 'compact', wrapped: false },
    },
  ],
  related: ['json-to-sql', 'json-to-csv', 'json-to-yaml', 'json-format'],
  status: 'stable',
};
