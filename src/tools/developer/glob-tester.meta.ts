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
  related: ['regex-tester', 'jsonpath', 'json-format', 'css-units'],
  status: 'stable',
};
