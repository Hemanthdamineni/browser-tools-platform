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
    {
      title: 'Character class in the file name',
      input: 'report1.csv\nreport2.csv\nreportA.csv',
      options: { pattern: 'report[0-9].csv' },
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
  article: [
    {
      heading: 'What the pattern language covers',
      body: 'The pattern is compiled to a regular expression and every pasted path is tested against it. An asterisk matches any run of characters except a slash, a double asterisk matches across directories — and a leading **/ also matches at the root — a question mark matches exactly one character, [a-z] is a character class and {js,ts} is an alternation, which may be nested inside a path segment. Everything else is matched literally.',
    },
    {
      heading: 'Anchoring, case and path normalisation',
      body: 'Matching is anchored to the whole path, so src/*.ts matches files sitting directly in src but not src/lib/a.ts. It is case-insensitive unless you tick Case-sensitive match. Leading ./ and / are stripped from each pasted path along with any trailing slash, so a list mixing styles from different tools still compares consistently.',
    },
    {
      heading: 'Reading the result table',
      body: 'Every path gets a row with a tick or a dash, and a summary line totals them — "4 of 6 paths matched". Blank lines are ignored, so a listing can be pasted straight from a terminal or a file browser. One run accepts up to 50,000 paths, which is enough to check an entire repository listing at once.',
    },
    {
      heading: 'Nothing is read from your disk',
      body: 'Paths are only text: the tool compiles a regular expression in this page and matches what you paste. It cannot and does not open files, nothing is uploaded, and no network request is made, so you can paste an internal directory tree without it going anywhere.',
    },
  ],
  related: ['regex-tester', 'jsonpath', 'json-format', 'css-units'],
  status: 'stable',
};
