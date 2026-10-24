import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'querystring',
  name: 'Query String <-> JSON',
  category: 'data',
  summary:
    'Parse a URL query string into JSON, or build a query string from a JSON object. Local only.',
  description:
    'Convert a URL query string (with or without a leading "?") into a pretty JSON object, or serialise a JSON object back into a query string. Repeated keys and key[] become arrays, with a configurable array format.',
  keywords: [
    'query string',
    'querystring',
    'query params',
    'url params',
    'search params',
    'qs',
    'querystring to json',
    'json to querystring',
    'parse query string',
    'url encode',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'parse',
      choices: [
        { value: 'parse', label: 'Query string -> JSON' },
        { value: 'build', label: 'JSON -> query string' },
      ],
    },
    {
      key: 'arrayFormat',
      label: 'Array format',
      type: 'select',
      default: 'brackets',
      choices: [
        { value: 'brackets', label: 'Brackets (key[]=a&key[]=b)' },
        { value: 'repeat', label: 'Repeat (key=a&key=b)' },
        { value: 'comma', label: 'Comma (key=a,b)' },
      ],
    },
    {
      key: 'sortKeys',
      label: 'Sort keys alphabetically',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'Parse a query string',
      input: '?q=hello+world&page=2&tag[]=a&tag[]=b',
      options: { mode: 'parse' },
    },
    {
      title: 'Parse repeated keys',
      input: 'id=1&id=2&id=3',
      options: { mode: 'parse', arrayFormat: 'repeat' },
    },
    {
      title: 'Build from JSON',
      input: '{ "q": "hello world", "tag": ["a", "b"] }',
      options: { mode: 'build' },
    },
  ],
  faq: [
    {
      q: 'How are repeated keys handled?',
      a: 'Any key that appears more than once becomes an array. With the brackets format a key ending in [] is always an array; with the comma format a value containing commas is split.',
    },
    {
      q: 'Is the input URL-decoded?',
      a: 'Yes. Keys and values are percent-decoded and + is treated as a space when parsing, and re-encoded when building.',
    },
  ],
  article: [
    {
      heading: 'Parse or build from the same box',
      body: 'In parse mode the box takes a query string, with or without a leading ? or #, and returns a pretty JSON object of the parameters. In build mode it takes a JSON object and returns the encoded query string without the ?. Both directions honour the array-format and sort-keys options.',
    },
    {
      heading: 'How repeated keys become arrays',
      body: 'A key appearing more than once becomes a JSON array whatever the format. With brackets, tag[]=a&tag[]=b is always an array and the [] is stripped from the key; with comma, a value containing commas is split into members; repeat is the plain key=a&key=b shape.',
    },
    {
      heading: 'Decoding and encoding rules',
      body: 'Parsing percent-decodes every key and value and treats + as a space, and a stray % that is not a valid escape raises a clear error. Building re-encodes with encodeURIComponent, so spaces become %20 and brackets become %5B%5D in the brackets format.',
    },
    {
      heading: 'Caveats and privacy',
      body: 'Sort keys orders only the top level alphabetically, arrays keep their order, and a nested object value is serialised with JSON.stringify into a single parameter rather than flattened. Nothing is fetched; the parser only reads your text, so query strings carrying tokens or personal data stay on your device.',
    },
  ],
  related: ['json-format', 'url-encode', 'json-to-yaml', 'csv-to-json'],
  status: 'stable',
};
