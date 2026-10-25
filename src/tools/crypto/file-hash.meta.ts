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
  article: [
    {
      heading: 'What a hash proves',
      body: 'A cryptographic digest is a fixed-length fingerprint of the file’s bytes: change a single bit and the whole hash changes. Comparing a downloaded file’s SHA-256 against the one published on the source site confirms the bytes you got are the bytes they shipped — the classic download-integrity check. Equal hashes across two files also flag likely duplicates.',
    },
    {
      heading: 'One or many files, one or many algorithms',
      body: 'Drop a single file to get its checksum, or several to hash each in turn. Pick SHA-256 (the default), SHA-384, SHA-512 or the legacy SHA-1. Pasting a value into the Expected hash field turns each result into a pass or fail check, and the output is a summary table plus a downloadable <name>.<algo> or checksums.<algo>.txt text file.',
    },
    {
      heading: 'Verifying a published checksum',
      body: 'Open the tool, drop the downloaded archive, paste the checksum the author published, and read the verdict. Because hashing runs in a Web Worker, large files keep the page responsive, and the Expected comparison is case-insensitive on the lowercase hex digest.',
    },
    {
      heading: 'Limits and privacy',
      body: 'The browser Web Crypto API needs the whole file in memory, so the practical ceiling is roughly your free RAM rather than disk space. Hashing happens entirely in this tab with no network request — the bytes are read locally, digested and discarded, so nothing you hash is ever uploaded.',
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
  faq: [
    {
      q: 'Why is MD5 not offered?',
      a: 'The Web Crypto API in browsers does not implement MD5, and it is unsuitable for integrity checks anyway. Use SHA-256 or stronger. A separate text MD5 tool exists for legacy interoperability.',
    },
    {
      q: 'How large a file can it handle?',
      a: 'Hashing runs in a Web Worker so the page stays responsive. The browser Web Crypto API needs the whole file in memory at once, so the practical limit is roughly your device’s free RAM (comfortably hundreds of MB). True multi-gigabyte streaming is on the roadmap.',
    },
    {
      q: 'Can I compare two files for duplicates?',
      a: 'Yes. Drop both files and compare their digests — identical bytes always produce the same hash for a given algorithm. Two files that hash the same are duplicates; note that this proves equality only for the algorithm used, so a collision in SHA-256 is not a practical concern.',
    },
  ],
  related: ['hash', 'hmac', 'crc32'],
  status: 'stable',
};
