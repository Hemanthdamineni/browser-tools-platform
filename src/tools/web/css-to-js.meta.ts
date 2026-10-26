import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'css-to-js',
  name: 'CSS to JS Object',
  category: 'web',
  summary: 'Convert CSS declarations or rule blocks into a JS object with camelCase style keys.',
  description:
    'Paste a CSS declaration list (color: red; font-size: 12px) or a rule block (a:hover { color: red }) and get the equivalent JS object with camelCase keys for CSS-in-JS, React inline styles or style objects. Handles comments, multiple rules, vendor prefixes (-webkit- → Webkit-), custom properties (~), and existing camelCase names unchanged.',
  keywords: [
    'css to js',
    'css to js object',
    'css to javascript object',
    'react inline style',
    'css-in-js converter',
    'camelCase css',
    'css style object',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'camelCase',
      label: 'Use camelCase property names (fontSize)',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Declaration list',
      input: 'color: red;\nfont-size: 12px;\nbackground-color: #fff;',
    },
    {
      title: 'A rule block',
      input: 'a:hover { color: red; text-decoration: none; }',
    },
    {
      title: 'Custom properties',
      input: '--primary: #007bff;\n--spacing: 8px;\n--radius: 4px;',
    },
  ],
  related: ['css-minifier', 'css-units', 'js-to-css', 'html-to-jsx'],
  status: 'stable',
};
