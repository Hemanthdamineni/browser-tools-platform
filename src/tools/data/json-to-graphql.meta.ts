import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-graphql',
  name: 'JSON to GraphQL Types',
  category: 'data',
  summary:
    'Generate GraphQL SDL type definitions from a sample JSON object, arrays to [Type], scalars inferred.',
  description:
    'Paste a JSON sample and get GraphQL SDL (Schema Definition Language) type definitions for it. Scalars are inferred as Int, Float, String or Boolean; nested objects become their own types; arrays become lists; and nulls map to a sensible default. Put a JSON response or configuration sample in one side and type definitions come out the other — everything runs on your device.',
  keywords: [
    'json to graphql',
    'graphql types generator',
    'json to sdl',
    'graphql schema from json',
    'generate graphql types',
    'json to graphql schema',
    'graphql type mapper',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'rootName',
      label: 'Root type name',
      type: 'text',
      default: 'Root',
    },
    {
      key: 'strictNull',
      label: 'Mark non-null fields with !',
      type: 'boolean',
      default: false,
    },
    {
      key: 'indent',
      label: 'Indent spaces',
      type: 'select',
      choices: [
        { value: '2', label: '2' },
        { value: '4', label: '4' },
      ],
      default: '2',
    },
  ],
  examples: [
    {
      title: 'From an API response',
      input:
        '{\n  "id": 1,\n  "name": "Ada",\n  "tags": ["admin", "staff"],\n  "profile": { "bio": null, "age": 36 }\n}',
    },
    {
      title: 'Nested objects and a list of objects',
      input:
        '{\n  "user": { "id": 7, "active": true },\n  "items": [ { "sku": "A1", "price": 9.99 } ]\n}',
      options: { rootName: 'Order', strictNull: true },
    },
    {
      title: 'Four-space indent',
      input: '{\n  "ok": true,\n  "count": 0\n}',
      options: { indent: '4' },
    },
  ],
  related: ['json-to-go-struct', 'json-to-typescript', 'json-to-zod', 'json-schema-to-typescript'],
  status: 'stable',
};
