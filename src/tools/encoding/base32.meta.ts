import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'base32',
  name: 'Base32 Encode / Decode',
  category: 'encoding',
  summary: 'RFC 4648 Base32 and Crockford Base32 encoding and decoding of text.',
  description:
    'Encode text to Base32 (case-insensitive, no ambiguous characters) or decode it back. Supports the standard RFC 4648 alphabet and Crockford’s variant used for IDs.',
  keywords: ['base32', 'rfc 4648', 'crockford', 'encode', 'decode', 'totp'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'encode',
      choices: [
        { value: 'encode', label: 'Text → Base32' },
        { value: 'decode', label: 'Base32 → Text' },
      ],
    },
    {
      key: 'variant',
      label: 'Alphabet',
      type: 'select',
      default: 'rfc4648',
      choices: [
        { value: 'rfc4648', label: 'RFC 4648 (A–Z 2–7)' },
        { value: 'crockford', label: 'Crockford (0–9 A–Z, no I L O U)' },
      ],
    },
    { key: 'padding', label: 'Add = padding (RFC only)', type: 'boolean', default: true },
    {
      key: 'lowercase',
      label: 'Lowercase output',
      type: 'boolean',
      default: false,
      showWhen: { key: 'mode', value: 'encode' },
    },
  ],
  examples: [
    { title: 'Encode "hello"', input: 'hello', options: { mode: 'encode' } },
    { title: 'Decode', input: 'NBSWY3DP', options: { mode: 'decode' } },
  ],
  faq: [
    {
      q: 'Why use Base32 over Base64?',
      a: 'Base32 is case-insensitive and avoids look-alike characters, so it survives being read aloud, typed by hand, or put in a filename or URL. TOTP secrets use it.',
    },
  ],
  related: [  "base64",
  "hex"],
  status: 'stable',
};
