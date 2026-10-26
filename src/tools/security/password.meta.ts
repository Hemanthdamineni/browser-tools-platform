import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'password',
  name: 'Password Generator',
  category: 'security',
  summary: 'Generate strong random passwords with your browser CSPRNG — no bias, nothing uploaded.',
  description:
    'Build one or many random passwords from the character classes you pick. Every character is drawn from crypto.getRandomValues with rejection sampling, so there is no modulo bias, and at least one character from each selected class is guaranteed.',
  keywords: [
    'password',
    'password generator',
    'random password',
    'strong password',
    'passphrase',
    'secret',
    'csprng',
    'entropy',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'length', label: 'Length', type: 'range', default: 20, min: 4, max: 128, step: 1 },
    { key: 'uppercase', label: 'Uppercase A–Z', type: 'boolean', default: true },
    { key: 'lowercase', label: 'Lowercase a–z', type: 'boolean', default: true },
    { key: 'digits', label: 'Digits 0–9', type: 'boolean', default: true },
    { key: 'symbols', label: 'Symbols', type: 'boolean', default: true },
    {
      key: 'avoidAmbiguous',
      label: 'Avoid ambiguous characters (0 O 1 l I | `)',
      type: 'boolean',
      default: false,
    },
    { key: 'count', label: 'How many', type: 'number', default: 1, min: 1, max: 50 },
  ],
  examples: [
    { title: '20-char, all classes', options: { length: 20 } },
    { title: '5 × 32-char, no ambiguous', options: { length: 32, count: 5, avoidAmbiguous: true } },
    {
      title: 'Digits-only PIN (8)',
      options: { length: 8, uppercase: false, lowercase: false, symbols: false },
    },
  ],
  related: ['passphrase', 'random-string', 'uuid'],
  status: 'stable',
};
