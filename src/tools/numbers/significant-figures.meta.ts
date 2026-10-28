import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'significant-figures',
  name: 'Significant Figures & Notation',
  category: 'numbers',
  summary: 'Count significant figures, see scientific and engineering notation, and round.',
  description:
    'Count the significant figures in a written number, spot the ambiguous cases, and see it expressed in scientific and engineering notation. Optionally round every value to a chosen number of significant figures. Precision is judged from the number as written, so 1200 and 1200. differ.',
  keywords: [
    'significant figures',
    'sig figs',
    'scientific notation',
    'engineering notation',
    'round to significant figures',
    'precision',
    'decimal places',
    'e notation',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'roundTo',
      label: 'Round to significant figures',
      type: 'number',
      default: 0,
      min: 0,
    },
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      choices: [
        { value: 'table', label: 'Table' },
        { value: 'lines', label: 'Lines' },
      ],
      default: 'table',
    },
  ],
  examples: [
    {
      title: 'Ambiguous trailing zeros',
      input: '0.00450\n1200\n1200.\n1.230e5',
    },
    {
      title: 'Scientific notation output',
      input: '602200000000000000000000\n0.00000000006626',
    },
    {
      title: 'Round to three figures',
      input: '3.14159\n2.71828\n1.41421356',
      options: { roundTo: 3 },
    },
  ],
  related: ['number-base', 'statistics-calculator', 'unit-convert', 'percentage-calculator'],
  status: 'stable',
};
