import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'hash',
  name: 'Text Hash Generator',
  category: 'crypto',
  summary:
    'Hash text with MD5, SHA-1, SHA-256, SHA-384 or SHA-512 and output hex, Base64 or base64url.',
  description:
    'Compute a cryptographic digest of the input text. The string is encoded as UTF-8 before hashing. SHA family digests use the Web Crypto API; MD5 is a pure-JavaScript RFC 1321 implementation.',
  keywords: [
    'hash',
    'md5',
    'sha1',
    'sha-1',
    'sha256',
    'sha-256',
    'sha384',
    'sha-384',
    'sha512',
    'sha-512',
    'checksum',
    'digest',
    'message digest',
    'hex',
    'base64',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'algorithm',
      label: 'Algorithm',
      type: 'select',
      default: 'sha-256',
      choices: [
        { value: 'md5', label: 'MD5' },
        { value: 'sha-1', label: 'SHA-1' },
        { value: 'sha-256', label: 'SHA-256' },
        { value: 'sha-384', label: 'SHA-384' },
        { value: 'sha-512', label: 'SHA-512' },
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
        { value: 'base64url', label: 'Base64 (URL-safe)' },
      ],
    },
    {
      key: 'uppercase',
      label: 'Uppercase hex',
      type: 'boolean',
      default: false,
      showWhen: { key: 'output', value: 'hex' },
    },
  ],
  examples: [
    { title: 'SHA-256 of "hello"', input: 'hello', options: { algorithm: 'sha-256' } },
    {
      title: 'MD5 checksum',
      input: 'The quick brown fox jumps over the lazy dog',
      options: { algorithm: 'md5' },
    },
    {
      title: 'SHA-1 as Base64',
      input: 'hello',
      options: { algorithm: 'sha-1', output: 'base64' },
    },
  ],
  faq: [
    {
      q: 'Are MD5 and SHA-1 safe to use?',
      a: 'No. Both are broken for collision resistance and must not be used for signatures, certificates or content deduplication where an attacker can influence the input. They are still fine as non-security checksums. Use SHA-256 or stronger for anything security related.',
    },
    {
      q: 'Is the text hashed as UTF-8?',
      a: 'Yes. The input string is encoded to UTF-8 bytes before hashing, so multi-byte characters produce the same digest as other UTF-8 tooling.',
    },
    {
      q: 'What is the URL-safe Base64 option?',
      a: 'Standard Base64 with "+" and "/" replaced by "-" and "_" and the trailing "=" padding removed, so the digest can be dropped straight into URLs and filenames.',
    },
  ],
  related: [  "hmac",
  "crc32",
  "file-hash",
  "base64"],
  status: 'stable',
};
