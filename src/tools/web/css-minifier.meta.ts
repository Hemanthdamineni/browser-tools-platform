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
  related: ['css-units', 'css-grid', 'gradient-css', 'media-query-builder'],
  status: 'stable',
};
