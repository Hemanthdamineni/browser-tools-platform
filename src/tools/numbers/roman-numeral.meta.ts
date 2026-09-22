import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'roman-numeral',
  name: 'Roman Numeral Converter',
  category: 'numbers',
  summary: 'Convert numbers to Roman numerals and back, with optional vinculum notation.',
  description:
    'Translate between Arabic numbers and strict subtractive Roman numerals in either direction. Optionally use vinculum (parenthesised) notation to reach 3,999,999, and validate or decode any Roman numeral you paste in.',
  keywords: [
    'roman numeral',
    'roman numerals converter',
    'roman to number',
    'number to roman',
    'MMXXIV',
    'vinculum',
    'latin numbers',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Auto-detect' },
        { value: 'to-roman', label: 'Number → Roman' },
        { value: 'to-number', label: 'Roman → Number' },
      ],
    },
    {
      key: 'extended',
      label: 'Extended range (vinculum notation)',
      type: 'boolean',
      default: false,
      help: 'Allow values up to 3,999,999 using parenthesised thousands, e.g. (IV) = 4000.',
    },
  ],
  examples: [
    { title: 'Number to Roman', input: '2024' },
    { title: 'Roman to number', input: 'MMXXIV' },
    { title: 'Extended range', input: '1234567', options: { extended: true } },
  ],
  faq: [
    {
      q: 'What forms are rejected?',
      a: 'Anything non-canonical: additive runs like IIII or VX are rejected because the converter validates by re-encoding, so only strict subtractive numerals decode.',
    },
    {
      q: 'What is the maximum without extended mode?',
      a: '3999 (MMMCMXCIX) — Roman numerals have no native symbol beyond 1000. Extended mode wraps thousands groups in parentheses, so (X) = 10,000.',
    },
  ],
  related: ['number-to-words', 'number-base'],
  status: 'stable',
};
