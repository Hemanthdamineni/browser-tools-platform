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
  article: [
    {
      heading: 'What a NanoID is',
      body: 'A NanoID is a short, URL-safe random identifier built from a small alphabet. At the default size of 21 characters from the URL-safe alphabet it carries comparable randomness to a UUID v4 but is about a third shorter and contains no hyphens, which is why it is a popular drop-in for keys, filenames, short links and database IDs. Each character is drawn from the alphabet you choose, and every character is equally likely.',
    },
    {
      heading: 'When to generate one',
      body: 'Reach for it when you need a unique value that is compact enough to show in a UI or put in a URL — an order reference, a share token, an upload filename, an ID for an analytics event. It is especially useful when you want several at once, because the count option emits up to 200 IDs separated by newlines in a single run.',
    },
    {
      heading: 'Sizes, alphabets and custom sets',
      body: 'The size runs from 2 to 64 characters. The alphabet select gives you URL-safe (A-Z a-z 0-9 _ -), lowercase, uppercase, digits, hex and full alphanumeric, or a custom alphabet of your own choosing — which must have at least 2 characters. A smaller alphabet makes shorter IDs more predictable, so the stats line shows the entropy in bits per ID to help you judge how much randomness you are actually getting.',
    },
    {
      heading: 'How the randomness stays unbiased',
      body: 'This uses the rejection-sampling variant of the official NanoID algorithm. Random bytes come from crypto.getRandomValues, a cryptographically strong generator, and values that fall outside the chosen alphabet are discarded rather than wrapped, so no character is favoured over another. There is no modulo bias, which matters when the alphabet size is not a power of two.',
    },
    {
      heading: 'Generated right here in your browser',
      body: "The IDs are produced locally with your device's cryptographic random source and never leave this tab. No server is contacted for the generation and nothing is stored, so the IDs are as private as the machine that made them.",
    },
  ],
  examples: [
    { title: 'One 21-char ID (default)', options: { size: 21, alphabet: 'url-safe', count: 1 } },
    { title: '10 short hex ids', options: { size: 8, alphabet: 'hex', count: 10 } },
    {
      title: 'Custom lowercase alphabet',
      options: { size: 12, alphabet: 'custom', custom: 'abcdefghjkmnpqrstuvwxyz', count: 5 },
    },
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
    {
      q: 'What does entropy per id mean?',
      a: 'It is size times log2 of the alphabet length, in bits — a rough measure of how many guesses an attacker would need. Higher is stronger; a default 21-character URL-safe ID works out to 126 bits.',
    },
  ],
  related: ['uuid', 'ulid', 'random-string'],
  status: 'stable',
};
