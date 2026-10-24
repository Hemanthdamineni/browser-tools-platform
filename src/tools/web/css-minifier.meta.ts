import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'css-minifier',
  name: 'CSS Minifier',
  category: 'web',
  summary:
    'Minify CSS: strip comments, collapse whitespace, drop empty rules and extra semicolons.',
  description:
    'Compress a stylesheet by removing comments, collapsing runs of whitespace, trimming space around selectors and declaration separators, dropping the final semicolon in each block and deleting empty rules. Strings, url() contents, calc() arithmetic spacing and @media conditions are preserved correctly, so the output stays valid. Runs fully on-device and reports the byte savings.',
  keywords: [
    'css minifier',
    'minify css',
    'css compressor',
    'compress css',
    'css optimizer',
    'css whitespace remover',
    'strip css comments',
    'css size reducer',
    'optimize stylesheet',
    'css shorthand minify',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'keepImportantComments',
      label: 'Keep /*! license comments',
      type: 'boolean',
      default: true,
    },
    {
      key: 'removeEmptyRules',
      label: 'Remove empty rules',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Minify a small stylesheet',
      input:
        '/* buttons */\n.btn {\n  color: #fff;\n  background: #2563eb;\n  padding: 8px 12px;\n}\n\n.btn:hover {\n  background: #1d4ed8;\n}',
    },
    {
      title: 'Keep calc arithmetic readable',
      input:
        '.grid {\n  width: calc(100% - 32px);\n  grid-template-columns: minmax(0, 1fr) auto;\n}',
    },
    {
      title: 'Drop banner comments as well',
      input: '/*! theme v3 */\n.card {\n  color: red;\n  padding: 0;\n}',
      options: { keepImportantComments: false },
    },
  ],
  faq: [
    {
      q: 'Will the minified CSS still be valid?',
      a: 'Yes. Whitespace is only removed where CSS allows it: never inside strings or url() contents, never between two identifiers, and always kept around + and - inside calc(), min(), max() and clamp(), where CSS requires it.',
    },
    {
      q: 'What happens to comments?',
      a: 'Normal comments are removed. Comments that start with /*! — the convention for licenses and banners — are kept by default; turn off "Keep /*! license comments" to drop them too.',
    },
    {
      q: 'Are empty rules really removed?',
      a: 'Yes, rules whose body is empty after minification are deleted, including nested ones and empty at-rule blocks. Disable "Remove empty rules" if you rely on them as placeholders.',
    },
    {
      q: 'Does it rename or merge selectors?',
      a: 'No. It is a safe, lossless whitespace and comment minifier: selectors, properties, values and their order are left exactly as written.',
    },
  ],
  article: [
    {
      heading: 'What the CSS Minifier removes',
      body: 'Paste a stylesheet and the tool strips comments, collapses runs of whitespace, trims space around selectors, braces and declaration separators, drops the final semicolon in each block, and deletes rules that end up empty. The result is the same CSS with fewer bytes, and the report tells you how much smaller it got.',
    },
    {
      heading: 'Trimming a stylesheet for shipping',
      body: 'Use it on hand-written or exported CSS just before you paste it into a template or inline it in a style element. Because the transformation only touches whitespace and comments, the styling is byte-for-byte equivalent, so you can minify a production rule set without a build step or a risk of changed behaviour.',
    },
    {
      heading: 'The two switches',
      body: 'Keep license comments leaves the /*! banner comments that tools and licences use, and turning it off strips those as well. Remove empty rules deletes blocks with nothing inside after minifying; switch it off if you keep them as deliberate placeholders.',
    },
    {
      heading: 'What is deliberately left alone',
      body: 'It never renames selectors, merges rules or rewrites values, so the output stays predictable. Spaces are preserved inside strings and url() contents, between two identifiers, and around plus and minus inside calc and the other maths functions where CSS requires them. Inputs beyond two megabytes are rejected.',
    },
    {
      heading: 'Your stylesheet is not uploaded',
      body: 'Minification happens in the page. Nothing is sent anywhere and the tool works offline, so a stylesheet that names internal components or carries licence text stays on your machine.',
    },
  ],
  related: ['css-units', 'css-grid', 'gradient-css', 'media-query-builder'],
  status: 'stable',
};
