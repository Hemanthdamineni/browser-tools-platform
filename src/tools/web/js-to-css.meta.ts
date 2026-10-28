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
  ],
  faq: [
    {
      q: 'Which properties get px?',
      a: 'Bare numbers on properties that accept lengths (width, margin, font-size…) become px. Numeric props like opacity, z-index, line-height, flex-grow and font-weight stay bare because CSS treats them as unitless.',
    },
    {
      q: 'How are booleans and null handled?',
      a: 'They are dropped — React uses truthiness to disable some properties (e.g. display: false), and CSS has no equivalent.',
    },
    {
      q: 'Can I convert a whole style tree?',
      a: 'Yes. A nested object becomes rules: { "@media (max-width: 600px)": { … } } or per-selector keys work the same way as css-to-js.',
    },
  ],
  related: [  "css-to-js",
  "css-minifier",
  "css-units",
  "gradient-css"],
  status: 'stable',
};
