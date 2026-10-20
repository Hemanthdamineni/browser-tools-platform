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
  ],
  faq: [
    {
      q: 'How is a decimal converted?',
      a: 'Exactly — 0.75 becomes 75/100, reduced by their gcd to 3/4. No lossy approximation: the digits you type determine the denominator (0.1 + 0.2 stays exact as long as the text is exact).',
    },
    {
      q: 'What do mixed numbers look like?',
      a: 'An improper fraction like 9/4 becomes 2 1/4 when the mixed-number option is on; otherwise it stays 9/4. The option affects output only.',
    },
    {
      q: 'Are negatives supported?',
      a: 'Yes — -6/4 reduces to -3/2, and a negative decimal like -1.5 becomes -3/2. The sign always lives on the numerator.',
    },
    {
      q: 'What input formats are accepted?',
      a: 'fractions as a/b, decimals like 0.75 or -1.5, and plain integers (3 → 3/1). A zero denominator or unparseable text is rejected with a clear error.',
    },
  ],
  related: ['unit-convert', 'roman-numeral', 'prime-factorization', 'statistics-calculator'],
  status: 'stable',
};
