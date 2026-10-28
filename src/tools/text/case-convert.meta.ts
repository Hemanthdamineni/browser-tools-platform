import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'case-convert',
  name: 'Case Converter',
  category: 'text',
  summary:
    'Convert between UPPER, lower, Title, Sentence, camelCase, snake_case, kebab-case and more.',
  description:
    'Switch text or an identifier between a dozen casing styles. Word boundaries are detected from spaces, punctuation and existing camelCase, so re-casing an identifier just works.',
  keywords: [
    'case',
    'uppercase',
    'lowercase',
    'title case',
    'camelcase',
    'snake_case',
    'kebab-case',
    'pascalcase',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'target',
      label: 'Convert to',
      type: 'select',
      default: 'title',
      choices: [
        { value: 'upper', label: 'UPPER CASE' },
        { value: 'lower', label: 'lower case' },
        { value: 'title', label: 'Title Case' },
        { value: 'sentence', label: 'Sentence case' },
        { value: 'camel', label: 'camelCase' },
        { value: 'pascal', label: 'PascalCase' },
        { value: 'snake', label: 'snake_case' },
        { value: 'constant', label: 'CONSTANT_CASE' },
        { value: 'kebab', label: 'kebab-case' },
        { value: 'dot', label: 'dot.case' },
        { value: 'path', label: 'path/case' },
        { value: 'capital', label: 'Capitalise Each Word' },
        { value: 'alternating', label: 'aLtErNaTiNg' },
        { value: 'inverse', label: 'iNVERSE (swap case)' },
      ],
    },
  ],
  examples: [
    { title: 'hello world → Title', input: 'hello world', options: { target: 'title' } },
    { title: 'user_id → camelCase', input: 'user_id_value', options: { target: 'camel' } },
    { title: 'MyComponent → kebab', input: 'MyHTTPComponent', options: { target: 'kebab' } },
  ],
  faq: [
    {
      q: 'How are words detected inside an identifier?',
      a: 'Runs are split on spaces, hyphens, underscores, dots and slashes, and also at lowercase→uppercase transitions and acronym boundaries (e.g. "HTTPServer" → "HTTP" + "Server").',
    },
  ],
  related: [  "slugify",
  "text-stats"],
  status: 'stable',
};
