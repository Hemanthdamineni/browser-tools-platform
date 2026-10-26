import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'fraction-simplify',
  name: 'Fraction Simplifier',
  category: 'numbers',
  summary:
    'Reduce a fraction to lowest terms, or convert a decimal to a fraction; optional mixed numbers.',
  description:
    'Simplify any fraction (12/18 → 2/3) or convert a decimal like 0.75 to its exact fraction (3/4). Accepts negatives, improper fractions, and mixed-note forms. The greatest common divisor used and the decimal value are shown, and an option converts improper fractions into mixed numbers. Everything runs on your device.',
  keywords: [
    'simplify fraction',
    'reduce fraction',
    'decimal to fraction',
    'lowest terms',
    'mixed number',
    'gcd fraction',
    'fraction reducer',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mixedNumber',
      label: 'Show improper fractions as mixed numbers',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'Reduce a fraction',
      input: '12/18',
    },
    {
      title: 'Decimal to fraction',
      input: '0.75',
    },
    {
      title: 'Improper fraction as a mixed number',
      input: '9/4',
      options: { mixedNumber: true },
    },
  ],
  related: ['unit-convert', 'roman-numeral', 'prime-factorization', 'statistics-calculator'],
  status: 'stable',
};
