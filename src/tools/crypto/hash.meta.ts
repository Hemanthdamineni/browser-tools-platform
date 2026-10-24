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
  article: [
    {
      heading: 'What it computes',
      body: 'This tool takes the text you type and returns a cryptographic digest of it as a fixed-length string. The input is first encoded as UTF-8 bytes and then hashed with the algorithm you choose, so identical text always yields the same digest and multi-byte characters produce the same result as any other UTF-8 tool. You pick the algorithm and the output encoding separately, then read the digest straight out of the box.',
    },
    {
      heading: 'Choosing an algorithm',
      body: 'SHA-256, SHA-384 and SHA-512 are the ones to reach for in real use: they are collision-resistant and fine for checksums, signing and integrity checks. SHA-1 and MD5 are implemented here for compatibility with legacy systems and older data formats, but both are broken for collision resistance and should not be used where an attacker can influence the input. They remain useful as plain non-security checksums.',
    },
    {
      heading: 'Output encodings',
      body: 'Hex is the familiar 64-character (for SHA-256) digest you see in package listings and verification pages. Base64 is about a third shorter and useful in binary contexts, while the URL-safe variant swaps + and / for - and _ and strips the padding, so the digest drops straight into a URL or filename. When the output is hex you can also request uppercase letters for a more readable value.',
    },
    {
      heading: 'Under the hood',
      body: 'The SHA family digests come from the browser Web Crypto API, so the computation is native and fast. MD5 is a self-contained JavaScript implementation of RFC 1321, which is why this tool works offline and with no network access at all. There is no salt and no key here — this is a plain message digest, not a keyed hash.',
    },
    {
      heading: 'Privacy',
      body: 'Hashing happens entirely on your device. The text you type is encoded and digested in this tab and never transmitted anywhere, which is what makes it safe to hash a secret or a private token here.',
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
  related: ['hmac', 'crc32', 'file-hash', 'base64'],
  status: 'stable',
};
