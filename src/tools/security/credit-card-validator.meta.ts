import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'credit-card-validator',
  name: 'Credit Card Validator',
  category: 'security',
  summary:
    'Check a card number with the Luhn algorithm and detect the card brand from its prefix.',
  description:
    'Validate a credit or debit card number on your device. The Luhn checksum is checked, the brand is detected from the IIN prefix (Visa, Mastercard, American Express, Discover, Diners Club, JCB, UnionPay), and the length is compared with what the brand allows. Spaces and dashes are ignored, letters are rejected, and you get a clear report of each check instead of a bare yes/no.',
  keywords: [
    'credit card validator',
    'luhn algorithm',
    'check card number',
    'card brand detection',
    'visa mastercard amex check',
    'luhn checksum',
    'validate card number',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'strictLength',
      label: 'Enforce the brand length',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'A valid Visa number',
      input: '4111 1111 1111 1111',
    },
    {
      title: 'An Amex number',
      input: '3782 822463 10005',
    },
  ],
  faq: [
    {
      q: 'Is this a real payment card check?',
      a: 'No — the result is a checksum (Luhn) and a formatting check only. It tells you whether the number is well-formed, not whether a real card exists. This never contacts a bank or network, and runs entirely on your device.',
    },
    {
      q: 'How is the brand detected?',
      a: 'From the leading digits: 4 for Visa, 51–55 and 2221–2720 for Mastercard, 34/37 for Amex, 6011/65/64x for Discover, and so on. Brand detection is for the Issuer Identification Number range only.',
    },
    {
      q: 'What if the brand is unknown?',
      a: 'The Luhn check still runs. Unknown prefixes are reported as an unrecognised brand with no length requirement, so the verdict rests on the checksum.',
    },
  ],
  related: ['hash', 'totp-authenticator', 'random-string', 'password-strength'],
  status: 'stable',
};
