import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'file-hash',
  name: 'File Hash / Checksum',
  category: 'crypto',
  summary: 'Compute SHA-256/384/512 and SHA-1 checksums for one or more files.',
  description:
    'Drop files to get their cryptographic hashes. Use it to verify a download against a published checksum or to spot duplicate files. Files are read locally and never uploaded.',
  keywords: ['hash', 'checksum', 'sha256', 'sha512', 'sha1', 'file integrity', 'verify', 'digest'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  multiple: true,
  accept: '',
  worker: true,
  options: [
    {
      key: 'algorithm',
      label: 'Algorithm',
      type: 'select',
      default: 'SHA-256',
      choices: [
        { value: 'SHA-256', label: 'SHA-256' },
        { value: 'SHA-384', label: 'SHA-384' },
        { value: 'SHA-512', label: 'SHA-512' },
        { value: 'SHA-1', label: 'SHA-1 (legacy)' },
      ],
    },
    {
      key: 'expected',
      label: 'Expected hash (optional)',
      type: 'text',
      default: '',
      placeholder: 'paste a checksum to verify against',
    },
  ],
  faq: [
    {
      q: 'Why is MD5 not offered?',
      a: 'The Web Crypto API in browsers does not implement MD5, and it is unsuitable for integrity checks anyway. Use SHA-256 or stronger. A separate text MD5 tool exists for legacy interoperability.',
    },
    {
      q: 'How large a file can it handle?',
      a: 'Hashing runs in a Web Worker so the page stays responsive. The browser Web Crypto API needs the whole file in memory at once, so the practical limit is roughly your device’s free RAM (comfortably hundreds of MB). True multi-gigabyte streaming is on the roadmap.',
    },
  ],
  related: [  "hash",
  "hmac",
  "crc32"],
  status: 'stable',
};
