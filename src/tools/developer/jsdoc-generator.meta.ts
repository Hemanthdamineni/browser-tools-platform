import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'jsdoc-generator',
  name: 'JSDoc Generator',
  category: 'developer',
  summary:
    'Generate a JSDoc comment block from a function signature, with @param and @returns lines.',
  description:
    'Paste a function signature and get a ready-to-fill JSDoc comment. Supports function declarations, arrow-style signatures, async, defaults, rest parameters, and simple destructuring. Each parameter becomes an @param line with its position preserved, a placeholder description, and a @returns line is added at the end. Keep the signature, drop the boilerplate — everything runs on your device.',
  keywords: [
    'jsdoc generator',
    'generate jsdoc from function',
    'jsdoc comment template',
    '@param template',
    'function documentation generator',
    'jsdoc scaffold',
    'doc block generator',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'description',
      label: 'Include a description placeholder',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Function declaration',
      input: 'function calculateTotal(items, taxRate = 0.2) { }',
    },
    {
      title: 'Arrow with rest params',
      input: 'async function fetchUser(id, ...opts) { }',
    },
    {
      title: 'Destructured options object',
      input: 'function render({ title, body }) { }',
    },
  ],
  related: ['regex-explainer', 'regex-tester', 'semver', 'objectid'],
  status: 'stable',
};
