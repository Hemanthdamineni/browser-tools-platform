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
  related: ['json-format', 'url-encode', 'json-to-yaml', 'csv-to-json'],
  status: 'stable',
};
