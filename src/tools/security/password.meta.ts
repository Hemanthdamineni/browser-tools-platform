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
  faq: [
    {
      q: 'How is “no modulo bias” achieved?',
      a: 'Random bytes are read as unsigned 32-bit integers and any value in the short final block that would skew the distribution is discarded and re-drawn (rejection sampling), so every character in the pool is equally likely.',
    },
    {
      q: 'What does the entropy figure mean?',
      a: 'It is log2(pool size) × length, the number of bits an attacker must brute-force on average. 20 characters from a ~90-character pool is roughly 129 bits.',
    },
    {
      q: 'Is anything sent anywhere?',
      a: 'No. Generation is local and offline; the passwords never leave your device.',
    },
  ],
  article: [
    {
      heading: 'What the Password Generator produces',
      body: 'It builds one or many random passwords from the character classes you tick, then joins them with newlines and offers the batch as passwords.txt, alongside the pool size, an entropy estimate in bits and a plain strength word.',
    },
    {
      heading: 'Choosing length and character classes',
      body: 'Length runs from 4 to 128 characters, defaulting to 20, and how many runs from 1 to 50. Uppercase, lowercase, digits and symbols are all on by default; turning one off shrinks the pool the tool draws from. At least one character from every class you keep is guaranteed, which matters for sites that demand a symbol.',
    },
    {
      heading: 'Bias, ambiguity and the entropy figure',
      body: 'Every character comes from crypto.getRandomValues with rejection sampling, so no value is more likely than another. Avoid ambiguous characters strips zero, O, one, l, I, the pipe and the backtick for pools you have to read aloud or retype. Entropy is log2 of the pool size times length, and the strength word runs from very weak under 28 bits to very strong at 128 and up.',
    },
    {
      heading: 'Nothing to upload, nothing to log',
      body: 'Generation is local and offline, so the passwords are never transmitted or logged by the tool; you alone hold them the moment they appear.',
    },
  ],
  related: ['passphrase', 'random-string', 'uuid'],
  status: 'stable',
};
