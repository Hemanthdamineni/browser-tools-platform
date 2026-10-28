import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'css-grid',
  name: 'CSS Grid Generator',
  category: 'web',
  summary: 'Generate CSS Grid layout declarations for tracks, gaps, alignment, and named areas.',
  description:
    'Build a copy-ready CSS Grid declaration from column and row tracks, gaps, alignment settings, and an optional named-area matrix. The generator validates track syntax and ensures named areas form valid rectangles.',
  keywords: [
    'css grid generator',
    'grid-template-columns',
    'grid-template-rows',
    'css grid layout',
    'grid areas generator',
    'responsive grid css',
    'grid gap calculator',
    'css layout generator',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'columns',
      label: 'Column tracks',
      type: 'text',
      default: 'repeat(3, 1fr)',
      placeholder: 'repeat(3, 1fr)',
    },
    {
      key: 'rows',
      label: 'Row tracks',
      type: 'text',
      default: 'auto',
      placeholder: 'auto 1fr auto',
    },
    { key: 'gap', label: 'Gap', type: 'text', default: '1rem', placeholder: '1rem or 16px' },
    { key: 'columnGap', label: 'Column gap override', type: 'text', default: '' },
    { key: 'rowGap', label: 'Row gap override', type: 'text', default: '' },
    {
      key: 'justifyItems',
      label: 'Justify items',
      type: 'select',
      default: 'stretch',
      choices: ['stretch', 'start', 'end', 'center'].map((value) => ({ value, label: value })),
    },
    {
      key: 'alignItems',
      label: 'Align items',
      type: 'select',
      default: 'stretch',
      choices: ['stretch', 'start', 'end', 'center'].map((value) => ({ value, label: value })),
    },
    {
      key: 'areas',
      label: 'Named areas (optional)',
      type: 'textarea',
      default: '',
      placeholder: 'header header\nsidebar main\nfooter footer',
    },
    {
      key: 'selector',
      label: 'Selector',
      type: 'text',
      default: '.layout',
      placeholder: '.layout',
    },
  ],
  examples: [
    {
      title: 'Three equal columns',
      options: { columns: 'repeat(3, 1fr)', rows: 'auto 1fr', gap: '1rem', selector: '.cards' },
    },
    {
      title: 'Named dashboard areas',
      options: {
        columns: '240px 1fr',
        rows: 'auto 1fr auto',
        areas: 'header header\nsidebar main\nfooter footer',
        gap: '1rem',
        selector: '.dashboard',
      },
    },
  ],
  faq: [
    {
      q: 'What syntax can tracks use?',
      a: 'Common CSS track syntax is accepted, including lengths, percentages, fr units, minmax(), repeat(), auto-fit, and auto-fill. The generator validates basic safety and non-empty declarations but does not fully parse CSS.',
    },
    {
      q: 'How are named areas validated?',
      a: 'Each non-dot area name must occupy one contiguous rectangle in the matrix. Every row must contain the same number of cells, and the optional dot represents an intentionally empty cell.',
    },
    {
      q: 'Does this add responsive breakpoints?',
      a: 'No. It generates one grid rule. Use repeat(auto-fit, minmax(...)) for many responsive layouts, or compose the output with media queries yourself.',
    },
  ],
  related: [  "css-units",
  "box-shadow",
  "fluid-clamp"],
  status: 'stable',
};
