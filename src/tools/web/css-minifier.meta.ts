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
  related: ['css-units', 'css-grid', 'gradient-css', 'media-query-builder'],
  status: 'stable',
};
