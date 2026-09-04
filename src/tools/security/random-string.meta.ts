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
