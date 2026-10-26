import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'jsonpath',
  name: 'JSONPath Extractor',
  category: 'developer',
  summary: 'Query JSON with JSONPath: select values by path, wildcards, filters, slices.',
  description:
    'Evaluate JSONPath expressions against a JSON document entirely on-device. Supports root shorthand, dot and bracket child selectors, wildcards, array indices and slices, recursive descent for deep lookups, and a practical filter expression syntax (e.g. [?(@.price > 10.5)]). Results are returned as JSON so you can pipe matched values straight into other tools or scripts. Handles large documents without any network access.',
  keywords: [
    'jsonpath',
    'query json',
    'json selector',
    'extract json',
    'json path',
    'json filter',
    'json query',
    'nested json',
    'json search',
    'json filter expression',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'compact',
      label: 'Compact output (no whitespace)',
      type: 'boolean',
      default: false,
    },
    {
      key: 'showPaths',
      label: 'Show matched paths too',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'Extract an array of names',
      input: '$.users[*].name\n{"users":[{"name":"Ada"},{"name":"Linus"},{"name":"Grace"}]}',
      options: {},
    },
    {
      title: 'Filter objects where price is above a threshold',
      input:
        '$.products[?(@.price > 20)].name\n{"products":[{"name":"Keyboard","price":25},{"name":"Cable","price":8}]}',
      options: {},
    },
    {
      title: 'Recursive descent, compact output',
      input: '$..author\n{"store":{"book":[{"author":"A"},{"author":"B"}]}}',
      options: { compact: true },
    },
  ],
  related: ['json-to-go-struct', 'json-to-zod', 'json-to-csharp', 'json-to-swift', 'json-diff'],
  status: 'stable',
};
