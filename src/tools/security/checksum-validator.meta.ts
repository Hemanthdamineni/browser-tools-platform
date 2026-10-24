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
  article: [
    {
      heading: 'Three checksums in one tool',
      body: 'Luhn validates payment-card-like numbers (12–19 digits) with the mod-10 algorithm, IBAN uses the MOD-97 scheme on the rearranged alphanumeric string, and ISBN-10 and ISBN-13 check the weighted modulo-11 and modulo-10 check digits. Enter one identifier per line and the tool checks several at once, reporting each result as Valid or Invalid with a short reason, then a count of how many passed.',
    },
    {
      heading: 'The point of a checksum',
      body: 'A check digit exists to catch transcription errors — a swapped pair, a mistyped digit, a lost space — before a value reaches an account, a card or a book record. Verifying it is a cheap first gate: a failed check means the identifier cannot be right, while a pass only means the digits are internally consistent, nothing more.',
    },
    {
      heading: 'How auto-detection decides',
      body: 'Auto-detect looks at the characters: values containing letters are tried as IBAN (two letters, two digits, then up to 30 alphanumerics) or as an ISBN; a pure digit string of exactly 13 characters is checked as ISBN-13, otherwise digit-only input goes to Luhn. Spaces and hyphens are stripped before the check, so formatted values like 4111 1111 1111 1111 or 0-306-40615-2 work as pasted.',
    },
    {
      heading: 'What it does not prove, and privacy',
      body: 'A valid checksum never confirms that an account exists, a card is active or an ISBN is a real publication — the tool contacts nothing and performs no lookups — so use synthetic test data, never live payment credentials. Every check runs locally in the page with no request, so an identifier from a private system is never sent anywhere.',
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
  faq: [
    {
      q: 'Does a valid checksum mean a card or account is real?',
      a: 'No. A valid checksum only means that the identifier is structurally consistent. It does not contact a bank, confirm account ownership, or establish that a card is active. Use synthetic test data, not live payment credentials.',
    },
    {
      q: 'How does auto-detection work?',
      a: 'Values containing letters are checked as possible IBAN or ISBN identifiers. Digit-only values are checked as ISBN-13 when 13 digits long, otherwise as Luhn candidates. Choose a format explicitly when in doubt.',
    },
    {
      q: 'Is my input sent to a server?',
      a: 'No. All checks run locally in your browser and no network requests are made.',
    },
  ],
  related: ['file-hash', 'hash', 'secret-scanner'],
  status: 'stable',
};
