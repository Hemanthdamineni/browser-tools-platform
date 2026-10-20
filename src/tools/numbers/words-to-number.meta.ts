import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'words-to-number',
  name: 'Words to Number',
  category: 'numbers',
  summary:
    'Parse English number words like "two hundred thirty-four" into 234, with decimals and negatives.',
  description:
    'Turn English number words into an actual number. It handles the whole scale — one … trillion — plus hundreds, hyphens (twenty-five), “and” (two hundred and five), decimals (two point five ≈> 2.5) and negatives (negative three ≈> -3). Unrelated words are ignored, so “the value is one million” still returns 1000000. Great for invoices, captchas, word-form data entry, or the reverse of number-to-words.',
  keywords: [
    'words to number',
    'parse number words',
    'english number parser',
    'word number to digit',
    'spelled out numbers to int',
    'number word converter',
    'text to number',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'grouping',
      label: 'Show with thousands separators',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Simple',
      input: 'one hundred twenty-three',
    },
    {
      title: 'Big number with punctuation',
      input: 'two billion, four hundred thirty-five million',
    },
  ],
  faq: [
    {
      q: 'What number formats are supported?',
      a: 'Whole words from zero to trillions, hundreds, tens with hyphens, “and”, decimal points and negative/mimus. Consecutive digit words such as “one two three” become 123.',
    },
    {
      q: 'Are unrelated words ignored?',
      a: 'Yes — non-number words are skipped. “The total is five thousand” gives 5000. If the input contains no number words at all you get a clear error.',
    },
    {
      q: 'How big can it go?',
      a: 'Up to trillions (1e12). Values larger than about a quadrillion are rejected with an error rather than guessed.',
    },
  ],
  related: ['number-to-words', 'roman-numeral', 'prime-factorization', 'case-convert'],
  status: 'stable',
};
