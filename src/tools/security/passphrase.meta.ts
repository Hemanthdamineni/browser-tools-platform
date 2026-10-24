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
  article: [
    {
      heading: 'A passphrase instead of a password',
      body: 'The tool draws a random set of words from a built-in list of short, common English words and joins them with the separator you choose, so you get something like "wren-veil-glint-amber-plot" rather than a 12-character password you cannot pronounce. The word count, from 3 to 12, sets how many words and therefore how long the phrase is.',
    },
    {
      heading: 'The entropy numbers',
      body: 'The embedded list holds 1110 words, about 10.1 bits of entropy per word, so the default five words come to roughly 51 bits and the maximum twelve reach about 121 bits. Every word is picked with crypto.getRandomValues and rejection sampling, so there is no modulo bias pulling the selection toward any word. The reported bit count in the result lets you judge whether a phrase is strong enough for the account it protects.',
    },
    {
      heading: 'Tuning the shape',
      body: 'Choose hyphens, spaces, dots, underscores or no separator at all to match the site’s rules — some forms reject spaces or special characters. Capitalising every word and appending a random 0–999 number each add a little strength, but as the FAQ notes a number only adds about ten bits and hurts memorability, so adding one more word is the better way to raise entropy.',
    },
    {
      heading: 'When to rely on it',
      body: 'This is for the accounts where you can paste a long phrase — a password manager, an email, a machine login. The short embedded word list stays inoffensive and pronounceable, which is the point of Diceware-style phrases: memorable enough to type by hand and strong enough that a dictionary attack on the words has no leverage.',
    },
    {
      heading: 'The selection never leaves the tab',
      body: 'Words are drawn from the embedded list with the browser’s crypto API — no word service is queried and nothing is stored, so the generated phrase is not echoed anywhere it should not be. The tool runs fully offline.',
    },
  ],
  faq: [
    {
      q: 'How big is the built-in word list?',
      a: 'It holds 1110 short, common, inoffensive English words (3–7 letters), which is about 10.1 bits of entropy per word — a 5-word passphrase is roughly 51 bits.',
    },
    {
      q: 'Would a larger list be stronger?',
      a: 'Yes. The EFF long Diceware list has 7776 words, giving about 12.9 bits per word, so the same number of words yields more entropy. The list here is kept small so it can be embedded and works fully offline.',
    },
    {
      q: 'Does the appended number add much?',
      a: 'Only about 10 bits, and it hurts memorability. Adding one more word is a better way to raise entropy.',
    },
  ],
  related: ['password', 'random-string', 'uuid'],
  status: 'stable',
};
