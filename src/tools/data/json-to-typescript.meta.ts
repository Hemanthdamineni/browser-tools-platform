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
  faq: [
    {
      q: 'How are nested types named?',
      a: 'Each nested object gets a PascalCase name built from its parent name plus the key, e.g. an "address" key under Root becomes RootAddress. Array element objects get an "Item" suffix.',
    },
    {
      q: 'What happens with null or mixed values?',
      a: 'A null value becomes the null type; an array holding several value types becomes a parenthesised union such as (number | string)[].',
    },
    {
      q: 'Are numbers split into int and float?',
      a: 'No. JSON has one number type, so every number becomes number.',
    },
  ],
  article: [
    {
      heading: 'From a sample to named type declarations',
      body: 'The tool parses one JSON value and emits TypeScript types for it. Every nested object becomes its own named type, with the name built from the parent name plus the key — an address field under Root becomes RootAddress. Array element objects get an Item suffix, so an array under a users key becomes RootUsersItem[]. The output is a runnable set of interface or type declarations you can paste into a project.',
    },
    {
      heading: 'Merging every element of an array',
      body: 'When Merge shape of every array element is on, the tool unions the shapes of all objects in an array rather than trusting only the first one. Keys present in some but not all elements become optional, and the value type is a union of every distinct type seen. Turn it off to sample just the first element and keep the type tighter.',
    },
    {
      heading: 'Choices that change the output',
      body: 'Root type name sets the name of the top-level declaration, and defaults to Root. Prefer interface produces interface blocks with semicolon properties; disabling it emits type aliases with equals signs. Mark properties readonly prefixes every field with readonly. Any key that is not a valid identifier is quoted, and a root name starting with a digit is prefixed with an underscore.',
    },
    {
      heading: 'How null and mixed values become types',
      body: 'A null value becomes the null type, a number always maps to number (JSON has no separate integer type), and an array holding several value types becomes a parenthesised union such as (number | string)[]. Because the input is a sample, generated types match what the JSON actually contains — they do not guess at fields that were missing from the data.',
    },
    {
      heading: 'Generation is fully local',
      body: 'The conversion is plain string building inside this tab and makes no network request, so it works offline and your JSON is never uploaded. The output is offered as a .ts download when you want to save it, alongside the code view in the workbench.',
    },
  ],
  related: ['json-to-jsonschema', 'json-format', 'json-to-yaml', 'yaml-to-json'],
  status: 'stable',
};
