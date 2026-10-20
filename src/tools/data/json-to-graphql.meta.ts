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
  ],
  faq: [
    {
      q: 'How are scalars mapped?',
      a: 'Strings map to String, booleans to Boolean, integers to Int and floats to Float. null gets a default scalar (String) so a missing value never breaks the schema.',
    },
    {
      q: 'What about arrays?',
      a: 'Arrays become list types: an array of strings maps to [String]. If the items are objects, each object becomes a type and the field becomes a list of that type.',
    },
    {
      q: 'Is every field nullable?',
      a: 'By default fields are nullable (no !), which is the safe choice for a sample. Turn on "Mark non-null fields with !" to add ! to every field that holds a concrete value.',
    },
    {
      q: 'How is the top-level name chosen?',
      a: 'The top-level object gets the name you provide in "Root type name"; nested objects are named after their field (camelCase → PascalCase). You can rename freely afterwards.',
    },
  ],
  related: ['json-to-go-struct', 'json-to-typescript', 'json-to-zod', 'json-schema-to-typescript'],
  status: 'stable',
};
