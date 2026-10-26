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
  related: ['roman-numeral', 'fraction-simplify'],
  status: 'stable',
};
