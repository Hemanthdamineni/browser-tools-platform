import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'bcrypt',
  name: 'Bcrypt Hash Generator & Verifier',
  category: 'crypto',
  summary:
    'Hash and verify passwords with bcrypt using a configurable cost factor, all on-device.',
  description:
    'Bcrypt is a password-hashing function based on the Blowfish cipher with a configurable cost factor (work factor) that makes it deliberately slow to resist brute-force attacks. This tool runs entirely on-device using a pure-JavaScript bcrypt implementation. Enter a password to hash it with a chosen cost factor (4–31), or enter both a password and an existing bcrypt hash to verify them.',
  keywords: [
    'bcrypt',
    'password hash',
    'hash password',
    'verify password',
    'blowfish',
    'cost factor',
    'work factor',
    'salt',
    'bcryptjs',
    'argon2 alternative',
    'password storage',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'hash',
      choices: [
        { value: 'hash', label: 'Hash password' },
        { value: 'verify', label: 'Verify password against hash' },
      ],
    },
    {
      key: 'cost',
      label: 'Cost factor (log2 rounds)',
      type: 'number',
      default: 10,
      min: 4,
      max: 31,
      step: 1,
      showWhen: { key: 'mode', value: 'hash' },
    },
    {
      key: 'hash',
      label: 'Bcrypt hash to verify against',
      type: 'textarea',
      default: '',
      placeholder: '$2b$10$...',
      showWhen: { key: 'mode', value: 'verify' },
    },
    {
      key: 'outputFormat',
      label: 'Output format',
      type: 'select',
      default: 'standard',
      choices: [
        { value: 'standard', label: 'Standard ($2b$...)' },
        { value: 'json', label: 'JSON with details' },
      ],
      showWhen: { key: 'mode', value: 'hash' },
    },
  ],
  examples: [
    {
      title: 'Hash a password with default cost (10)',
      input: 'my-secret-password',
      options: { mode: 'hash', cost: 10 },
    },
    {
      title: 'Hash with higher cost factor for more security',
      input: 'my-secret-password',
      options: { mode: 'hash', cost: 12 },
    },
    {
      title: 'Verify a password against a bcrypt hash',
      input: 'my-secret-password',
      options: {
        mode: 'verify',
        hash: '$2b$10$rTkPm8.9qK5VxK3V5YqZ5O5V5YqZ5O5V5YqZ5O5V5YqZ5O5V5YqZ5O',
      },
    },
  ],
  faq: [
    {
      q: 'What is the cost factor?',
      a: 'The cost factor (also called work factor) determines how many rounds of Blowfish key expansion are performed. Each increment doubles the work. Cost 10 means 2^10 = 1,024 rounds. Higher costs are more secure but slower. The default of 10 is a good baseline; OWASP recommends at least 12 as of 2024.',
    },
    {
      q: 'Why is bcrypt slow?',
      a: "That's intentional. Bcrypt is designed to be computationally expensive to resist brute-force and rainbow-table attacks. The cost factor lets you tune the slowness to match your hardware and threat model.",
    },
    {
      q: 'What does the hash format $2b$10$... mean?',
      a: 'The prefix $2b$ identifies the bcrypt version (2b = current standard). The next number (10) is the cost factor. The remaining 53 characters are the 22-character salt (base64-encoded) concatenated with the 31-character hash (also base64-encoded), using a custom base64 alphabet.',
    },
    {
      q: 'Can I use this for production password storage?',
      a: 'Yes. The implementation follows the bcrypt specification and uses cryptographically secure random salts. For production use, consider also using a server-side secret (pepper) and storing hashes in a secure database. Always use HTTPS and follow OWASP password storage guidelines.',
    },
    {
      q: 'What is the difference between $2a$, $2b$, $2x$, $2y$?',
      a: 'These are bcrypt version markers. $2a$ was the original; $2b$ fixed a bug with non-ASCII characters (PHPass compatibility); $2x$/$2y$ are OpenBSD variants. This tool produces $2b$ hashes (the current standard) and verifies all variants.',
    },
  ],
  related: ['pbkdf2-key-derivation', 'hash', 'hmac', 'uuid'],
  status: 'stable',
};