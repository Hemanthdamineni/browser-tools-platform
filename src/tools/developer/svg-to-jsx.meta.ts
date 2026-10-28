import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'svg-to-jsx',
  name: 'SVG to JSX / React Component',
  category: 'developer',
  summary:
    'Convert SVG or XML markup into JSX — camelCased attributes, style objects, optional component.',
  description:
    'Turn raw SVG (or other inline markup) into JSX/TSX that React accepts: kebab-case attributes become camelCase, class becomes className, inline style strings become style objects, comments become JSX comments, and empty elements self-close. Optionally wrap the result in a typed React component with a props spread. Everything runs on your device.',
  keywords: [
    'svg to jsx',
    'svg to react',
    'svg react component',
    'convert svg jsx',
    'jsx attribute converter',
    'svg to tsx',
    'react icon component',
    'camelcase svg attributes',
    'svg props react',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'component',
      label: 'Wrap in a React component',
      type: 'boolean',
      default: true,
    },
    {
      key: 'componentName',
      label: 'Component name',
      type: 'text',
      default: 'Icon',
      placeholder: 'Icon',
    },
    {
      key: 'typescript',
      label: 'TypeScript (SVGProps)',
      type: 'boolean',
      default: true,
    },
    {
      key: 'styleObjects',
      label: 'Convert style="" to objects',
      type: 'boolean',
      default: true,
    },
    {
      key: 'indent',
      label: 'Indent width (spaces)',
      type: 'number',
      default: 2,
      min: 0,
    },
  ],
  examples: [
    {
      title: 'Inline SVG as a component',
      input:
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n  <path d="M4 4h16v16H4z" stroke-width="2" class="icon"/>\n</svg>',
    },
    {
      title: 'Style string and comment',
      input:
        '<svg viewBox="0 0 10 10"><!-- dot --><circle cx="5" cy="5" r="4" style="fill: red; stroke-width: 2;"/></svg>',
    },
    {
      title: 'Plain JSX, no component wrapper',
      input: '<svg viewBox="0 0 16 16"><path d="M0 0h16v16H0z"/></svg>',
      options: { component: false, typescript: false },
    },
  ],
  related: ['svg-to-png', 'html-prettifier', 'json-to-typescript', 'html-to-markdown'],
  status: 'stable',
};
