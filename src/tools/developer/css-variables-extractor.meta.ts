import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'css-variables-extractor',
  name: 'CSS Variables Extractor',
  category: 'developer',
  summary: 'Extract every CSS custom property from a stylesheet into a table of names, values and scope.',
  description:
    'Paste a stylesheet and get every CSS custom property (--name: value) as a table: name, resolved value, and the selector scope it was declared in (:root, .theme-dark, a media query, …). Duplicate declarations are grouped so you can see overrides at a glance, and optional output formats turn the tokens into a JSON object or JavaScript/TypeScript map for use in code.',
  keywords: [
    'css variables extractor',
    'css custom properties',
    'extract css variables',
    'design tokens css',
    'css var list',
    'css variables to json',
    'theme tokens',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'output',
      label: 'Output format',
      type: 'select',
      choices: [
        { value: 'table', label: 'Table (name, value, scope)' },
        { value: 'json', label: 'JSON object' },
        { value: 'js', label: 'JavaScript object' },
        { value: 'scss', label: 'SCSS variables' },
      ],
      default: 'table',
    },
    {
      key: 'includeComments',
      label: 'Keep comments in SCSS output',
      type: 'boolean',
      default: false,
    },
    {
      key: 'dedupe',
      label: 'Group duplicate declarations',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'A small theme',
      input: ':root {\n  --brand: #2563eb;\n  --radius: 8px;\n}\n.theme-dark {\n  --brand: #60a5fa;\n}',
    },
  ],
  faq: [
    {
      q: 'What does "scope" mean?',
      a: 'The selector that declared the variable — :root for globals, .theme-dark for a theme override, or the enclosing @media/@supports block. Seeing the scope explains where an override takes effect.',
    },
    {
      q: 'How are duplicates handled?',
      a: 'The same variable declared in several scopes is grouped, listing every scope and value in order, so override chains are obvious. Turn grouping off to see one row per declaration.',
    },
    {
      q: 'Which formats can I export?',
      a: 'A table, a flat JSON object, a JavaScript object, or SCSS $variables. The JSON/JS forms are handy for feeding tokens into a design system.',
    },
  ],
  related: ['css-minifier', 'css-specificity-calculator', 'css-units', 'color-palette'],
  status: 'stable',
};
