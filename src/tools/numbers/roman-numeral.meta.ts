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
  article: [
    {
      heading: 'Both directions with automatic detection',
      body: 'Type 2024 and you get MMXXIV; type MMXXIV and you get 2024. In auto mode anything built only from the letters I, V, X, L, C, D, M and parentheses is read as a numeral and everything else as a decimal, so you rarely touch the Mode dropdown. Empty input simply returns an empty result.',
    },
    {
      heading: 'Extended range and the vinculum trick',
      body: 'Standard notation stops at 3999 because it has no symbol above M. Turn on extended range and values up to 3,999,999 encode by wrapping the thousands group in parentheses — 4000 becomes (IV) and 10,000 becomes (X) — and decoding accepts one such group plus the remainder.',
    },
    {
      heading: 'Validation works by re-encoding',
      body: 'A numeral is decoded and then re-encoded: only if the round trip reproduces your exact input is it accepted. That is what rejects additive or scrambled forms such as IIII, VX or IC. Lowercase text and stray spaces are normalised first, so mmxxiv converts fine.',
    },
    {
      heading: 'Guard rails and where the lookup runs',
      body: 'Zero, negatives and decimals are refused with a message that numerals start at 1, and decoding stops at the first character outside the Roman set. Extended mode adds its own limit of one parenthesised group, and decoding a parenthesised form without extended mode enabled is an error. The whole conversion is a local table lookup, so nothing you paste is sent anywhere.',
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
    {
      q: 'Is lowercase or spaced input accepted?',
      a: 'Yes. Text is upper-cased and whitespace stripped before decoding, so “mm xxiv” reads the same as “MMXXIV”, and the canonical check runs against the normalised form.',
    },
  ],
  related: ['number-to-words', 'number-base'],
  status: 'stable',
};
