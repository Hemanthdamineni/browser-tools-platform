import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'svg-optimizer',
  name: 'SVG Optimizer',
  category: 'web',
  summary: 'Minify or pretty-print SVG, rounding coordinates, stripping comments and empty groups.',
  description:
    'Paste an SVG (for example straight out of a vector editor) and get a leaner version. Runs entirely on your device. Minify mode produces a single-line document with collapsed whitespace; pretty mode re-indents it to 2 spaces. Numeric attributes are rounded to a configurable precision, XML comments and truly empty <g> groups can be stripped, and no colour values, paths or other meaning are changed — only the document is re-serialized. The size before and after is reported so you can see what changed.',
  keywords: [
    'svg optimizer',
    'minify svg',
    'svg minifier',
    'optimize svg',
    'clean svg',
    'svg formatter',
    'compress svg',
    'remove svg comments',
    'svgo alternative',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Output style',
      type: 'select',
      choices: [
        { value: 'minify', label: 'Minify (single line)' },
        { value: 'pretty', label: 'Pretty (indented)' },
      ],
      default: 'minify',
    },
    {
      key: 'precision',
      label: 'Decimal precision (0–6)',
      type: 'number',
      default: 2,
      min: 0,
    },
    {
      key: 'stripComments',
      label: 'Remove comments',
      type: 'boolean',
      default: true,
    },
    {
      key: 'removeEmptyGroups',
      label: 'Remove empty <g> elements',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Minify an editor export',
      input:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">\n  <!-- arrow -->\n  <g>\n    <path d="M4 4.000 L20 20.000" stroke="#000" stroke-width="1.500000"/>  \n  </g>\n</svg>',
    },
    {
      title: 'Pretty format',
      input:
        '<svg viewBox="0 0 10 10"><rect x="0.1500000" y="0" width="10" height="10" fill="none"/></svg>',
      options: { mode: 'pretty' },
    },
    {
      title: 'Pretty with comments kept',
      input:
        '<svg viewBox="0 0 24 24"><!-- icon --><circle cx="12.12345" cy="12" r="6.500000" fill="#0af"/></svg>',
      options: { mode: 'pretty', stripComments: false, precision: 1 },
    },
  ],
  related: ['svg-to-jsx', 'data-uri', 'html-prettifier', 'css-minifier'],
  status: 'stable',
};
