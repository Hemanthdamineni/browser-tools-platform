import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'checksum-validator',
  name: 'Identifier Checksum Validator',
  category: 'security',
  summary: 'Check Luhn, IBAN MOD-97, ISBN-10, and ISBN-13 checksums locally.',
  description:
    'Validate identifier formatting and checksum digits for payment-card-like numbers (Luhn), IBANs, and ISBNs. Enter one identifier per line to check several at once. This checks structure and transcription errors only, not whether an account, card, or book record is real or active.',
  keywords: [
    'luhn check',
    'credit card number validator',
    'iban validator',
    'iban mod 97',
    'isbn validator',
    'isbn check digit',
    'checksum verification',
    'identifier validation',
    'mod 10 checksum',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'format',
      label: 'Identifier format',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Auto-detect' },
        { value: 'luhn', label: 'Luhn (digits)' },
        { value: 'iban', label: 'IBAN' },
        { value: 'isbn', label: 'ISBN-10 / ISBN-13' },
      ],
    },
  ],
  examples: [
    {
      title: 'Luhn checksum (test number)',
      input: '4111 1111 1111 1111',
      options: { format: 'luhn' },
    },
    { title: 'IBAN checksum', input: 'GB82 WEST 1234 5698 7654 32', options: { format: 'iban' } },
    { title: 'ISBN-10 with X check digit', input: '0-306-40615-2', options: { format: 'isbn' } },
  ],
  related: ['file-hash', 'hash', 'secret-scanner'],
  status: 'stable',
};
