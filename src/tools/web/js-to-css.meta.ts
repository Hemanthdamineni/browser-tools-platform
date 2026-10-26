import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'js-to-css',
  name: 'JS Object to CSS',
  category: 'web',
  summary:
    'Turn a JS style object into CSS: camelCase to kebab-case, numbers to px-aware values, rules support.',
  description:
    'Convert a React-style JS object (or a plain JSON object) back into CSS. camelCase keys become kebab-case, WebkitTransform becomes -webkit-transform, numbers become px where length units apply (opacity, z-index and friends stay unitless), and booleans are dropped. A bare object makes a declaration list; nested makes rules. Complements css-to-js.',
  keywords: [
    'js object to css',
    'react style to css',
    'css from js object',
    'camelCase to kebab-case css',
    'inline style to css',
    'style object to css',
    'css-in-js export',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'pxForNumbers',
      label: 'Add px for bare length numbers (12 → 12px)',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'React style object to CSS',
      input: '{ color: "#fff", fontSize: 12, lineHeight: 1.4 }',
    },
    {
      title: 'Nested to rules',
      input: '{ "a:hover": { color: "red" } }',
    },
    {
      title: 'Unitless numbers stay unitless',
      input: '{ opacity: 0.5, zIndex: 10, transform: "scale(1.2)" }',
    },
  ],
  related: ['css-to-js', 'css-minifier', 'css-units', 'gradient-css'],
  status: 'stable',
};
