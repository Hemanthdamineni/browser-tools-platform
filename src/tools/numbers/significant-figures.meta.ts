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
      max: 21,
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
  ],
  faq: [
    {
      q: 'Why do 1200 and 1200. have different answers?',
      a: 'Trailing zeros only count as significant when a decimal point shows they were measured. 1200 is ambiguous - it could mean two, three or four significant figures - so it is flagged. Writing 1200. or 1.200e3 states four clearly.',
    },
    {
      q: 'How are leading zeros treated?',
      a: 'Zeros before the first non-zero digit never count. In 0.00450 only the 4, 5 and final 0 are significant, which is why it has three significant figures.',
    },
    {
      q: 'What is engineering notation?',
      a: 'Like scientific notation, but the exponent is always a multiple of three so it lines up with SI prefixes such as kilo, milli and micro. 1.230e5 becomes 123.0e3.',
    },
    {
      q: 'Are commas and spaces allowed?',
      a: 'Yes. Thousands separators, spaces and underscores are ignored, so 1,200 and 1_200 are read the same as 1200.',
    },
  ],
  related: [  "number-base",
  "statistics-calculator",
  "unit-convert",
  "percentage-calculator"],
  status: 'stable',
};
