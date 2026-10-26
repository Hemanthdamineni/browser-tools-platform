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
  examples: [
    {
      title: 'SHA-256 a file',
      options: { algorithm: 'SHA-256' },
    },
    {
      title: 'Verify against a published checksum',
      options: {
        algorithm: 'SHA-256',
        expected: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    },
    {
      title: 'Hash with the stronger SHA-512',
      options: { algorithm: 'SHA-512' },
    },
  ],
  related: ['hash', 'hmac', 'crc32'],
  status: 'stable',
};
