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
  article: [
    {
      heading: 'Converting between any two radices',
      body: 'Enter a whole number and pick a source and target base between 2 and 36. The value is parsed digit by digit into a BigInt and written back out in the target base, so nothing is ever narrowed to a 53-bit floating-point number. Base 36 uses the digits 0-9 followed by a-z, which makes the tool useful for short identifiers as well as binary and hexadecimal work.',
    },
    {
      heading: 'Prefixes and ignored separators',
      body: 'A leading 0x, 0o or 0b prefix overrides the From base setting and selects hexadecimal, octal or binary, while a leading minus or plus sign sets the sign. Underscores, spaces, commas and apostrophes are stripped before parsing, so 1_000_000 or 1,000,000 can be pasted straight from source code or a spreadsheet without cleaning them first.',
    },
    {
      heading: 'Output formatting options',
      body: 'Add prefix rewrites the result with 0x, 0o or 0b when the target is base 16, 8 or 2 — other bases are left plain. Group digits inserts a space every four characters counted from the right, which makes long binary and hexadecimal values far easier to read at a glance.',
    },
    {
      heading: 'Rejected digits are named',
      body: 'A character that is not a valid digit for the selected source base stops the conversion with a message naming the offending character, rather than truncating the value silently. Negative zero is normalised to a plain zero, and the tool never evaluates expressions — digits only.',
    },
    {
      heading: 'No size limit, no upload',
      body: 'Because parsing uses BigInt the input length is bounded only by the text you paste; very long binary strings convert exactly. The calculation runs in this tab with no network request, so the number never leaves your browser.',
    },
  ],
  related: ['hex', 'chmod-calculator', 'hash-identifier', 'base32'],
  status: 'stable',
};
