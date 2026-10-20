import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'svg-optimizer',
  name: 'SVG Optimizer',
  category: 'web',
  summary:
    'Minify or pretty-print SVG, rounding coordinates, stripping comments and empty groups.',
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
      max: 6,
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
      input: '<svg viewBox="0 0 10 10"><rect x="0.1500000" y="0" width="10" height="10" fill="none"/></svg>',
      options: { mode: 'pretty' },
    },
  ],
  faq: [
    {
      q: 'Does it change how the SVG looks?',
      a: 'No. Only the serialization changes: whitespace between tags, comments (when enabled), empty <g> groups and numeric precision. Colours, paths and attribute values keep their meaning. "none" fills and stroke remain untouched.',
    },
    {
      q: 'What does rounding do to attributes?',
      a: 'Numeric tokens in attribute values (geometry, transform matrices that are present, coordinates) are rounded to the chosen precision. Colour values (hex like #fff or rgb(...)), identifiers and unit suffixes are left alone.',
    },
    {
      q: 'Is minified output safe to inline in HTML?',
      a: 'Yes — a single-line SVG is generally the most bandwidth-friendly for inlining. If any browser parser has issues with your exact file you can switch to pretty mode for a readable diff first.',
    },
    {
      q: 'Does it handle malformed SVG?',
      a: 'It reports a clear error if the opening <svg> element is missing or tags are unbalanced, rather than emitting a broken document.',
    },
  ],
  related: ['svg-to-jsx', 'data-uri', 'html-prettifier', 'css-minifier'],
  status: 'stable',
};
