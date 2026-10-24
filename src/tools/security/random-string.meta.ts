import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'random-string',
  name: 'Random String Generator',
  category: 'security',
  summary: 'Generate random strings from a chosen character set with an unbiased browser CSPRNG.',
  description:
    'Produce one or many random strings of any length from a preset or custom character set. Characters are drawn from crypto.getRandomValues with rejection sampling, so there is no modulo bias.',
  keywords: [
    'random string',
    'random',
    'token',
    'api key',
    'nonce',
    'salt',
    'hex',
    'base64url',
    'csprng',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'length', label: 'Length', type: 'number', default: 32, min: 1, max: 4096 },
    {
      key: 'charset',
      label: 'Character set',
      type: 'select',
      default: 'alphanumeric',
      choices: [
        { value: 'alphanumeric', label: 'Alphanumeric (A–Z a–z 0–9)' },
        { value: 'alpha', label: 'Letters (A–Z a–z)' },
        { value: 'lowercase', label: 'Lowercase (a–z)' },
        { value: 'uppercase', label: 'Uppercase (A–Z)' },
        { value: 'digits', label: 'Digits (0–9)' },
        { value: 'hex-lower', label: 'Hex lower (0–9 a–f)' },
        { value: 'hex-upper', label: 'Hex upper (0–9 A–F)' },
        { value: 'base64url', label: 'base64url (A–Z a–z 0–9 - _)' },
        { value: 'custom', label: 'Custom…' },
      ],
    },
    {
      key: 'custom',
      label: 'Custom characters',
      type: 'text',
      default: '',
      placeholder: 'e.g. ABCDEF0123456789',
      showWhen: { key: 'charset', value: 'custom' },
    },
    { key: 'count', label: 'How many', type: 'number', default: 1, min: 1, max: 200 },
  ],
  article: [
    {
      heading: 'What it produces and how it comes back',
      body: 'Choose a length, a character set and how many strings you need; the result is the strings separated by newlines in a code view that saves as random-strings.txt. The stats line reports the resolved set size, the length used, the rounded entropy in bits and how many were generated.',
    },
    {
      heading: 'Rejection sampling, not a modulo shortcut',
      body: 'Every character index comes from crypto.getRandomValues and is accepted only when it falls below the largest multiple of the set size, so no character is favoured. That differs measurably from simply taking a random 32-bit value modulo the alphabet length, which skews short sets such as the ten digits.',
    },
    {
      heading: 'Presets, custom sets and silent clamping',
      body: 'Nine presets run from letters-only through hex to base64url, and the custom field collapses duplicates, so "aab" behaves like "ab"; an empty custom set is rejected. Length and count are clamped rather than refused, so asking for 5000 characters quietly yields 4096 and asking for 500 strings yields 200.',
    },
    {
      heading: 'Entropy figures and where the bytes come from',
      body: 'The entropy shown is log2 of the set size multiplied by the length, so 32 alphanumeric characters reads as roughly 191 bits; it describes one string, not the whole batch. The workbench text area is unused, every parameter is an option, and no request is made — the values are drawn on your device.',
    },
  ],
  examples: [
    { title: '32-char alphanumeric', options: { length: 32, charset: 'alphanumeric' } },
    { title: '64 hex chars', options: { length: 64, charset: 'hex-lower' } },
    { title: '10 × 21-char base64url', options: { length: 21, charset: 'base64url', count: 10 } },
  ],
  faq: [
    {
      q: 'How is bias avoided?',
      a: 'Each character index is read as an unsigned 32-bit integer; values in the short final block that would over-represent some characters are discarded and re-drawn (rejection sampling).',
    },
    {
      q: 'What happens with duplicate custom characters?',
      a: 'Duplicates are collapsed, so "aab" behaves like "ab". An empty custom set is rejected.',
    },
    {
      q: 'Is this suitable for tokens and salts?',
      a: 'Yes — the randomness comes from crypto.getRandomValues, the same CSPRNG used for cryptographic keys. The entropy figure shown is log2(set size) × length.',
    },
  ],
  related: ['password', 'passphrase', 'uuid'],
  status: 'stable',
};
