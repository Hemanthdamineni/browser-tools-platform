import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'credit-card-validator',
  name: 'Credit Card Validator',
  category: 'security',
  summary: 'Check a card number with the Luhn algorithm and detect the card brand from its prefix.',
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
    {
      title: 'Luhn check without the brand length rule',
      input: '4111 1111 1111 1111',
      options: { strictLength: false },
    },
  ],
  related: ['hash', 'totp-authenticator', 'random-string', 'password-strength'],
  status: 'stable',
};
