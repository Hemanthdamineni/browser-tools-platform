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
      input: '$.users[*].name',
      options: {},
    },
    {
      title: 'Filter objects where price is above a threshold',
      input: '$.products[?(@.price > 20)].name',
      options: {},
    },
    {
      title: 'Recursive descent, compact output',
      input: '$..author\n{"store":{"book":[{"author":"A"},{"author":"B"}]}}',
      options: { compact: true },
    },
  ],
  article: [
    {
      heading: 'What it does',
      body: 'The first non-blank line is the JSONPath expression; everything below it is the JSON document, which must parse. Matches are returned as a JSON array, indented by two spaces unless compact is on, with a note giving the number of matched nodes. Comparison operators, wildcards, slices and recursive descent all work on the parsed value.',
    },
    {
      heading: 'When to use it',
      body: 'Handy for pulling a few fields out of a bulky API response without writing a script. Paste the response under an expression such as $.items[?(@.stock > 0)].sku and copy the resulting array straight into your own code or a spreadsheet.',
    },
    {
      heading: 'The two options',
      body: 'compact drops the indentation so the output is one dense line, which is easier to paste into a command line. showPaths wraps each match as an object with its path and value, so you can see where a value came from in a deeply nested document.',
    },
    {
      heading: 'Limitations',
      body: 'The filter syntax covers ==, !=, <, <=, >, >= with string, number, boolean and null literals on the right, but not script expressions. Traversal stops after one million visited nodes, and the document part must be strictly valid JSON, so trailing commas or comments will be reported as an error.',
    },
    {
      heading: 'Privacy',
      body: 'Expressions are evaluated on-device with no request leaving the page. That is deliberate: pasted JSON often carries user records or API tokens, and none of it is uploaded or cached anywhere.',
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
  related: ['json-to-go-struct', 'json-to-zod', 'json-to-csharp', 'json-to-swift', 'json-diff'],
  status: 'stable',
};
