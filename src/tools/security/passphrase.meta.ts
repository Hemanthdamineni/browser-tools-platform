import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'passphrase',
  name: 'Passphrase Generator',
  category: 'security',
  summary: 'Diceware-style passphrases from an embedded word list — memorable and high-entropy.',
  description:
    'Generate a random passphrase by drawing words from a built-in list of short, common English words. Every word is chosen with crypto.getRandomValues and rejection sampling, so the selection is unbiased.',
  keywords: [
    'passphrase',
    'diceware',
    'password',
    'word password',
    'memorable password',
    'xkcd password',
    'secret',
    'entropy',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'words', label: 'Number of words', type: 'number', default: 5, min: 3, max: 12 },
    {
      key: 'separator',
      label: 'Separator',
      type: 'select',
      default: 'hyphen',
      choices: [
        { value: 'hyphen', label: 'Hyphen ( - )' },
        { value: 'space', label: 'Space' },
        { value: 'dot', label: 'Dot ( . )' },
        { value: 'underscore', label: 'Underscore ( _ )' },
        { value: 'none', label: 'None' },
      ],
    },
    { key: 'capitalize', label: 'Capitalize each word', type: 'boolean', default: false },
    { key: 'addNumber', label: 'Append a random number (0–999)', type: 'boolean', default: false },
  ],
  examples: [
    { title: '5 words, hyphenated', options: { words: 5, separator: 'hyphen' } },
    {
      title: '6 words, capitalized + number',
      options: { words: 6, capitalize: true, addNumber: true },
    },
    { title: '4 words, spaces', options: { words: 4, separator: 'space' } },
  ],
  related: ['password', 'random-string', 'uuid'],
  status: 'stable',
};
