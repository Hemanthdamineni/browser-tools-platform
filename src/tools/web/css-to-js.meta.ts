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
  ],
  faq: [
    {
      q: 'What if my input is a full rule, not a declaration list?',
      a: 'Both work. A rule is converted to a nested object keyed by selector, e.g. a:hover becomes "a:hover": { color: "red" }; a bare declaration list becomes a flat object.',
    },
    {
      q: 'How are vendor prefixes handled?',
      a: '-webkit-transform becomes WebkitTransform (capitalised after the dash) like React expects. CSS custom properties (--accent) are left untouched since they are not camelCased.',
    },
    {
      q: 'Is the output always a single object?',
      a: 'Yes — one flat object for a declaration list, or one object with selectors as keys when rules are given. Value strings are escaped so the output is always valid JS.',
    },
  ],
  related: [  "css-minifier",
  "css-units",
  "js-to-css",
  "html-to-jsx"],
  status: 'stable',
};
