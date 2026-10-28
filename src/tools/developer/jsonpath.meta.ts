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
      input:
        '$.users[*].name\n\n{\n  "users": [\n    { "id": 1, "name": "Ada Lovelace" },\n    { "id": 2, "name": "Grace Hopper" },\n    { "id": 3, "name": "Katherine Johnson" }\n  ]\n}',
      options: {},
    },
    {
      title: 'Filter objects where price is above a threshold',
      input:
        '$.products[?(@.price > 20)].name\n\n{\n  "products": [\n    { "name": "Keyboard", "price": 12.5 },\n    { "name": "Monitor", "price": 240 },\n    { "name": "Mouse", "price": 8 }\n  ]\n}',
      options: {},
    },
  ],
  faq: [
    {
      q: 'What JSONPath syntax is supported?',
      a: 'Root shorthand ($ or omitted), dot child (.field), bracket child (["field"]), wildcard (.* or [*]), array indices and slices ([0], [1:3]), recursive descent (..field), and filters [?(@.field OP value)] with ==, !=, <, <=, >, >= and string/number comparisons.',
    },
    {
      q: 'What happens when the expression has no matches?',
      a: 'An empty result [] is returned with a message in the notes; this is not a parse error.',
    },
    {
      q: 'Where must the JSON document go?',
      a: 'Paste the JSON as the second line/block of input, separated by a blank line from the expression. The first non-whitespace line is treated as the JSONPath expression; the remainder as JSON.',
    },
    {
      q: 'Is the filter syntax full JSONPath spec?',
      a: 'It covers the common operators and nested paths of the widely used JSONPath for JavaScript dialect. Advanced script expressions are not supported, but the implemented subset handles typical real-world queries.',
    },
  ],
  related: [  "json-to-go-struct",
  "json-to-zod",
  "json-to-csharp",
  "json-to-swift",
  "json-diff"],
  status: 'stable',
};
