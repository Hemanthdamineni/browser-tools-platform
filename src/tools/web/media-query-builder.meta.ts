import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'media-query-builder',
  name: 'Media Query Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect CSS @media queries.',
  description:
    'Generate or analyze CSS @media query conditions. Builds min-width, max-width, or width-range breakpoints with optional feature conditions, and validates pasted queries for balanced parentheses, known features, and meaningful structure.',
  keywords: [
    'media query',
    '@media',
    'CSS breakpoints',
    'min-width',
    'max-width',
    'responsive design',
    'prefers-color-scheme',
    'prefers-reduced-motion',
    'hover',
    'pointer',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'analyze',
      choices: [
        { value: 'analyze', label: 'Analyze query' },
        { value: 'build', label: 'Build query' },
      ],
    },
    { key: 'minWidth', label: 'min-width (e.g. 768px)', type: 'text', default: '768px' },
    { key: 'maxWidth', label: 'max-width (empty to omit)', type: 'text', default: '' },
    { key: 'features', label: 'Extra conditions (e.g. (hover: hover))', type: 'text', default: '' },
  ],
  examples: [
    { title: 'Analyze a breakpoint', input: '@media (min-width: 768px) and (max-width: 1024px)' },
    {
      title: 'Build a mobile-first query',
      options: { mode: 'build', minWidth: '480px', features: '(prefers-reduced-motion: reduce)' },
    },
    {
      title: 'Analyze a range query',
      input: '@media (hover: hover) and (min-width: 768px)',
    },
  ],
  related: ['css-grid', 'fluid-clamp', 'css-units'],
  status: 'stable',
};
