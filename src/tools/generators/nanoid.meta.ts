import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'nanoid',
  name: 'NanoID Generator',
  category: 'generators',
  summary: 'Generate compact, URL-safe NanoIDs with unbiased randomness, in bulk.',
  description:
    'Create NanoIDs — short, URL-safe unique ids — in any size or alphabet. Uses the unbiased NanoID algorithm over crypto.getRandomValues, so every character is equally likely.',
  keywords: [
    'nanoid',
    'nano id',
    'unique id',
    'identifier',
    'url-safe id',
    'random id',
    'short id',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'size', label: 'ID size', type: 'number', default: 21, min: 2, max: 64 },
    {
      key: 'alphabet',
      label: 'Alphabet',
      type: 'select',
      default: 'url-safe',
      choices: [
        { value: 'url-safe', label: 'URL-safe (A–Z a–z 0–9 _ -)' },
        { value: 'lowercase', label: 'Lowercase letters' },
        { value: 'uppercase', label: 'Uppercase letters' },
        { value: 'numbers', label: 'Digits' },
        { value: 'hex', label: 'Hex (0–9 a–f)' },
        { value: 'alphanumeric', label: 'Alphanumeric' },
        { value: 'custom', label: 'Custom' },
      ],
    },
    {
      key: 'custom',
      label: 'Custom alphabet',
      type: 'text',
      default: '',
      showWhen: { key: 'alphabet', value: 'custom' },
      placeholder: 'any characters, at least 2',
    },
    { key: 'count', label: 'How many', type: 'number', default: 1, min: 1, max: 200 },
  ],
  examples: [
    { title: 'One 21-char ID (default)', options: { size: 21, alphabet: 'url-safe', count: 1 } },
    { title: '10 short hex ids', options: { size: 8, alphabet: 'hex', count: 10 } },
  ],
  faq: [
    {
      q: 'Why NanoID instead of a UUID?',
      a: 'At the default 21 characters a NanoID has comparable randomness to a UUID v4 but is a third shorter and URL-safe with no hyphens.',
    },
    {
      q: 'Is the randomness unbiased?',
      a: 'Yes. It uses the rejection-sampling variant of the official NanoID algorithm: random bytes are masked and values outside the alphabet are discarded rather than wrapped.',
    },
  ],
  related: ['uuid', 'ulid', 'random-string'],
  status: 'stable',
};
