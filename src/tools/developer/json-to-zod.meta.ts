import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-zod',
  name: 'JSON to Zod Schema',
  category: 'developer',
  summary:
    'Generate a Zod schema from a JSON sample so you can validate runtime data and infer clean types.',
  description:
    'Paste a JSON object or array and get a Zod schema (z.object, z.string, z.array and friends) that type-checks that shape at runtime. Whole and fractional numbers both become z.number(), null becomes z.any(), empty arrays become z.array(z.any()) with the same caveats you would expect from inference. Copy it into your app to validate API payloads.',
  keywords: [
    'json to zod',
    'zod schema generator',
    'zod types',
    'json to zod schema',
    'zod validation',
    'zod infer',
    'json validator',
    'typescript runtime validation',
    'zod object',
    'api payload schema',
    'schema from json',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'variable',
      label: 'Schema variable name',
      type: 'text',
      default: 'schema',
      placeholder: 'schema',
    },
  ],
  examples: [
    {
      title: 'Simple user payload',
      input: '{"id":1,"name":"Ada","active":true,"email":"ada@example.com","roles":["admin"]}',
      options: { variable: 'userSchema' },
    },
    {
      title: 'Nested object and empty array',
      input: '{"address":{"city":"London","zip":"SW1"},"tags":[]}',
      options: {},
    },
    {
      title: 'Decimal values and boolean flags',
      input: '{"price":19.99,"available":true,"currency":"EUR"}',
      options: {},
    },
  ],
  related: ['json-to-typescript', 'json-to-go-struct', 'json-to-yaml', 'json-to-csv', 'json-diff'],
  status: 'stable',
};
