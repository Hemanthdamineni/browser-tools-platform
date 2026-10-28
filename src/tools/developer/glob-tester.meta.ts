import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'glob-tester',
  name: 'Glob Tester',
  category: 'developer',
  summary: 'Match a glob pattern against file paths: *, **, ?, [...] classes and {a,b} sets.',
  description:
    'Write a glob pattern such as src/**/*.ts or **/*.{js,ts} and paste a list of file paths to see which ones match. Supports the * single-segment wildcard, ** recursive wildcard, ? single character, [...] character classes and {a,b} alternates, with optional case-insensitive matching. Results are shown per path in a table with a match total. Everything runs on-device, so your file paths never leave the browser.',
  keywords: [
    'glob tester',
    'glob pattern',
    'glob matcher',
    'file path match',
    'glob wildcard',
    'glob test',
    'match files pattern',
    'glob double star',
    'path matcher',
    'glob to regex',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'pattern',
      label: 'Glob pattern',
      type: 'text',
      default: '**/*.ts',
      placeholder: 'src/**/*.{ts,tsx}',
    },
    {
      key: 'caseSensitive',
      label: 'Case-sensitive match',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'Match source files recursively',
      input: 'src/index.ts\nsrc/lib/util.ts\ntests/app.test.ts\nREADME.md',
      options: { pattern: 'src/**/*.ts' },
    },
    {
      title: 'Match TS and JS files anywhere',
      input: 'a.ts\nb.js\nc.txt\nx/d.tsx',
      options: { pattern: '**/*.{ts,js}' },
    },
  ],
  faq: [
    {
      q: 'Which glob features are supported?',
      a: '* matches any characters except /, ** matches zero or more directories, ? matches one character, [...] is a character class and {a,b} is an alternation group. Everything else is matched literally.',
    },
    {
      q: 'How does a leading **/ behave?',
      a: 'A pattern beginning with **/ matches at any depth including the root, so **/*.ts matches src/a.ts and tests/x/a.ts. Without ** the pattern is anchored to the start of the path.',
    },
    {
      q: 'Is matching case sensitive?',
      a: 'No by default. Turn on "Case-sensitive match" to require exact casing.',
    },
    {
      q: 'Do I need to prefix paths with ./ ?',
      a: 'No. Leading ./ or / on both the pattern and the input paths is normalized away before matching.',
    },
  ],
  related: [  "regex-tester",
  "jsonpath",
  "json-format",
  "css-units"],
  status: 'stable',
};
