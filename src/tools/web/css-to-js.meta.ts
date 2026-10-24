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
  article: [
    {
      heading: 'Declaration lists and rule blocks',
      body: 'Paste a bare declaration list such as color: red; font-size: 12px and get one flat object, or paste complete rules and get an object keyed by selector, so a:hover becomes a quoted key whose value is its own style object. The parser tracks quotes and braces, so semicolons inside a quoted value do not split a declaration and an unbalanced brace is reported rather than guessed at.',
    },
    {
      heading: 'Property names for react',
      body: 'With camelCase on, font-size becomes fontSize and background-color becomes backgroundColor, which is the shape React inline styles and most CSS-in-JS libraries expect. Turning it off keeps property names verbatim for frameworks that want kebab-case keys. Custom properties are never camelCased.',
    },
    {
      heading: 'Prefixes and comments',
      body: 'A vendor prefix is capitalised after the dash, so -webkit-transform becomes WebkitTransform, matching the JavaScript property name. Block comments are stripped before parsing, and a declaration with no colon is ignored rather than breaking the output, which keeps a pasted stylesheet resilient to stray text.',
    },
    {
      heading: 'Converted in the page',
      body: 'The stylesheet text is parsed by plain string handling in this tab. Nothing is uploaded, no request is sent to any server, and the resulting object is produced instantly from the bytes you pasted.',
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
  related: ['css-minifier', 'css-units', 'js-to-css', 'html-to-jsx'],
  status: 'stable',
};
