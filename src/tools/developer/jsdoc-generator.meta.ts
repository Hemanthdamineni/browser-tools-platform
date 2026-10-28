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
  ],
  faq: [
    {
      q: 'Which signatures does it accept?',
      a: 'Function declarations (function name(a, b)), the shorthand name(a, b), async functions, arrows (const f = (x) => …), defaults, rest parameters and simple object/array destructuring.',
    },
    {
      q: 'How are parameters named?',
      a: 'Each parameter becomes @param with its original name and position. Destructured parameters get the whole pattern name (e.g. { name } for the props object), with a hint to expand it into @property lines if you need them.',
    },
    {
      q: 'Is @returns always included?',
      a: 'Yes, a @returns line is always emitted as a template. Async functions keep the same shape — you can annotate Promise<…> yourself.',
    },
  ],
  related: [  "regex-explainer",
  "regex-tester",
  "semver",
  "objectid"],
  status: 'stable',
};
