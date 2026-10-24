import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'number-to-words',
  name: 'Number to Words',
  category: 'numbers',
  summary: 'Spell out numbers in cardinal or ordinal English words with flexible casing.',
  description:
    'Convert whole numbers and short decimal values into readable English words. Choose cardinal or ordinal style, optional "and", and the casing that fits your document.',
  keywords: [
    'number to words',
    'spell number',
    'number in English',
    'ordinal numbers',
    'cardinal numbers',
    'check writer',
    'amount in words',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'style',
      label: 'Style',
      type: 'select',
      default: 'cardinal',
      choices: [
        { value: 'cardinal', label: 'Cardinal' },
        { value: 'ordinal', label: 'Ordinal' },
      ],
    },
    {
      key: 'letterCase',
      label: 'Letter case',
      type: 'select',
      default: 'lower',
      choices: [
        { value: 'lower', label: 'lowercase' },
        { value: 'sentence', label: 'Sentence case' },
        { value: 'title', label: 'Title Case' },
        { value: 'upper', label: 'UPPERCASE' },
      ],
    },
    {
      key: 'useAnd',
      label: 'Use "and"',
      help: 'Use British-style "and" before the final tens or units within a group.',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    { title: 'Invoice amount', input: '1234' },
    { title: 'Decimal', input: '3.14' },
    { title: 'Ordinal', input: '21', options: { style: 'ordinal' } },
  ],
  faq: [
    {
      q: 'How large a number is supported?',
      a: 'Integers up to 10^21 are supported, along with negative values and decimals of up to four places.',
    },
    {
      q: 'How are decimals read?',
      a: 'Digits after the decimal point are spoken individually, so 3.14 becomes "three point one four".',
    },
    {
      q: 'Can decimals be written as ordinals?',
      a: 'No. Ordinal conversion applies only to whole-number wording, so a decimal input is rejected when the ordinal style is selected.',
    },
  ],
  article: [
    {
      heading: 'What the converter does',
      body: 'Turn a plain number string into English words, choosing between cardinal and ordinal style. Whole numbers up to 10^21 are supported along with negatives and decimals of up to four places; a larger magnitude throws a "Number is too large to express in words" error.',
    },
    {
      heading: 'When to spell out a number',
      body: 'Write a cheque or invoice amount in words, check the wording of a formal letter, or generate an ordinal such as twenty-first for a title. The output is a plain string that drops straight into a document.',
    },
    {
      heading: 'Options that affect wording',
      body: 'The style switch selects cardinal or ordinal forms. Letter case applies lower, sentence, title or upper casing, leaving "and" lowercase in title case. The use-and switch adds the British "and" before the final tens or units within each group.',
    },
    {
      heading: 'Limits and formatting rules',
      body: 'Input must match a plain integer or decimal pattern or it is rejected. Tens and units within a group are hyphenated, negatives are prefixed with "negative", and a decimal part longer than four places raises an error.',
    },
    {
      heading: 'Conversion runs locally',
      body: 'The number is processed with BigInt and string manipulation inside this tab, so no input is transmitted and the tool keeps working offline.',
    },
  ],
  related: ['roman-numeral', 'fraction-simplify'],
  status: 'stable',
};
