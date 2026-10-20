import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'pbkdf2-key-derivation',
  name: 'PBKDF2 Key Derivation',
  category: 'crypto',
  summary:
    'Derive a key from a passphrase with PBKDF2-HMAC, or verify a stored PBKDF2 password hash.',
  description:
    'Stretch a passphrase into a cryptographic key with PBKDF2 (RFC 8018) using the Web Crypto API. Pick the PRF hash, iteration count, salt and key length; get the key as hex or base64. Paste an expected value to check a stored password hash without sending anything to a server.',
  keywords: [
    'pbkdf2',
    'key derivation',
    'kdf',
    'password hashing',
    'password hash verify',
    'derive key',
    'salt',
    'iterations',
    'pbkdf2-hmac-sha256',
    'rfc 8018',
    'django password hash',
    'wpa2 psk',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'hash',
      label: 'PRF hash',
      type: 'select',
      default: 'sha-256',
      choices: [
        { value: 'sha-256', label: 'SHA-256' },
        { value: 'sha-512', label: 'SHA-512' },
        { value: 'sha-1', label: 'SHA-1 (legacy)' },
      ],
    },
    {
      key: 'iterations',
      label: 'Iterations',
      type: 'number',
      default: 600000,
      min: 1,
      max: 5000000,
      step: 1000,
    },
    {
      key: 'length',
      label: 'Key length (bytes)',
      type: 'number',
      default: 32,
      min: 1,
      max: 1024,
      step: 1,
    },
    {
      key: 'salt',
      label: 'Salt',
      type: 'text',
      default: 'toolbench-salt',
      placeholder: 'random per-user salt',
    },
    {
      key: 'saltEncoding',
      label: 'Salt encoding',
      type: 'select',
      default: 'text',
      choices: [
        { value: 'text', label: 'UTF-8 text' },
        { value: 'hex', label: 'Hex' },
        { value: 'base64', label: 'Base64' },
      ],
    },
    {
      key: 'output',
      label: 'Output encoding',
      type: 'select',
      default: 'hex',
      choices: [
        { value: 'hex', label: 'Hex' },
        { value: 'base64', label: 'Base64' },
      ],
    },
    {
      key: 'expected',
      label: 'Expected key (verify)',
      type: 'text',
      default: '',
      placeholder: 'optional hex or base64 to compare',
    },
  ],
  examples: [
    {
      title: 'PBKDF2-HMAC-SHA256 (600k iterations)',
      input: 'correct horse battery staple',
      options: { hash: 'sha-256', iterations: 600000, length: 32 },
    },
    {
      title: 'RFC 6070 test vector (SHA-1, 4096 iterations)',
      input: 'password',
      options: { hash: 'sha-1', iterations: 4096, length: 20, salt: 'salt' },
    },
    {
      title: 'Base64 output',
      input: 'hunter2',
      options: { iterations: 100000, output: 'base64' },
    },
  ],
  faq: [
    {
      q: 'What is PBKDF2 used for?',
      a: 'PBKDF2 turns a low-entropy passphrase into a fixed-length key by hashing it together with a salt many thousands of times. It is used for password storage (Django, WPA2, 1Password exports), for deriving encryption keys from passphrases, and for key stretching before use with AES or HMAC.',
    },
    {
      q: 'How many iterations should I use?',
      a: 'OWASP currently recommends 600,000 iterations for PBKDF2-HMAC-SHA256 and 210,000 for SHA-512. Higher counts slow attackers proportionally, so pick the largest number your sign-in latency budget allows.',
    },
    {
      q: 'Why is a salt required?',
      a: 'A salt prevents identical passphrases from producing identical keys and defeats precomputed rainbow tables. Never reuse a salt across users, and store it next to the hash so verification can repeat the derivation.',
    },
    {
      q: 'Is my passphrase sent anywhere?',
      a: 'No. Derivation runs locally with the browser Web Crypto API, and the page makes no network requests at all.',
    },
    {
      q: 'How does verification work?',
      a: 'Paste the expected key (hex or base64) into the verify field. The tool re-derives the key and compares the bytes in constant time, reporting Match or Mismatch — the same check a server performs when you sign in.',
    },
    {
      q: 'How is the expected key interpreted?',
      a: 'An even number of hex digits (spaces, colons and dashes are ignored) is read as hex; anything else is decoded as base64. Match the output encoding to whatever format your stored hash uses.',
    },
  ],
  related: ['hash', 'hmac', 'password-strength', 'file-hash', 'text-encrypt'],
  status: 'stable',
};
