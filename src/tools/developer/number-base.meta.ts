import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'number-base',
  name: 'Number Base Converter',
  category: 'developer',
  summary: 'Convert an integer between any bases from 2 to 36 with arbitrary precision (BigInt).',
  description:
    'Convert a whole number from one radix to another, base 2 through base 36, using BigInt so there is no size limit. Accepts an optional 0x / 0o / 0b prefix and a leading minus sign, and ignores underscores, spaces and separators in the input.',
  keywords: [
    'number base converter',
    'radix converter',
    'base conversion',
    'binary to decimal',
    'decimal to hex',
    'hex to binary',
    'base 36',
    'bigint',
    'arbitrary precision',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'fromBase',
      label: 'From base',
      type: 'number',
      default: 10,
      min: 2,
      max: 36,
    },
    {
      key: 'toBase',
      label: 'To base',
      type: 'number',
      default: 16,
      min: 2,
      max: 36,
    },
    {
      key: 'addPrefix',
      label: 'Add 0x / 0o / 0b prefix (base 16 / 8 / 2)',
      type: 'boolean',
      default: false,
    },
    {
      key: 'groupDigits',
      label: 'Group output digits by 4',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    { title: '255 (dec) to hex', input: '255', options: { fromBase: 10, toBase: 16 } },
    {
      title: 'Binary to decimal',
      input: '0b1010',
      options: { fromBase: 2, toBase: 10 },
    },
    {
      title: 'Large hex to binary, grouped',
      input: '0xDEADBEEF',
      options: { fromBase: 16, toBase: 2, groupDigits: true },
    },
  ],
  faq: [
    {
      q: 'How large a number can it handle?',
      a: 'Any size. Parsing and conversion use BigInt, so there is no 53-bit floating-point limit.',
    },
    {
      q: 'What input formats are accepted?',
      a: 'An optional leading minus sign, an optional 0x / 0o / 0b prefix, and digits 0-9 then a-z for values 10-35. Underscores, spaces, commas and apostrophes are stripped.',
    },
    {
      q: 'What happens if a digit is invalid for the chosen base?',
      a: 'The tool reports which character is out of range for the "from base" you selected.',
    },
  ],
  related: ['hex', 'chmod-calculator', 'hash-identifier', 'base32'],
  status: 'stable',
};
