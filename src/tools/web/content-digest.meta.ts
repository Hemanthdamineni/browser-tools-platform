import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'content-digest',
  name: 'Content-Digest Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Content-Digest integrity fields.',
  description:
    'Generate or analyze SHA-256 and SHA-512 Content-Digest values using structured-field syntax. Validates base64 payloads, algorithm labels, and duplicate entries locally; it does not hash or fetch a message body.',
  keywords: [
    'Content-Digest',
    'Digest header',
    'HTTP integrity',
    'SHA-256 digest header',
    'SHA-512 digest',
    'structured fields',
    'message digest',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'analyze',
      choices: [
        { value: 'analyze', label: 'Analyze digest' },
        { value: 'build', label: 'Build digest field' },
      ],
    },
    {
      key: 'algorithm',
      label: 'Algorithm',
      type: 'select',
      default: 'sha-256',
      choices: [
        { value: 'sha-256', label: 'sha-256' },
        { value: 'sha-512', label: 'sha-512' },
      ],
    },
    { key: 'digest', label: 'Base64 digest value', type: 'text', default: '' },
  ],
  examples: [
    {
      title: 'Analyze Content-Digest',
      input: 'sha-256=:47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=:',
    },
    {
      title: 'Build a field from a known digest',
      options: {
        mode: 'build',
        algorithm: 'sha-256',
        digest: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
      },
    },
  ],
  faq: [
    {
      q: 'Does this hash my content?',
      a: 'No. Paste a digest generated elsewhere or use a file-hashing tool first. This utility only formats and validates digest field syntax.',
    },
    {
      q: 'Is Digest the same as encryption?',
      a: 'No. A digest detects changes when compared against a trusted expected value; it does not conceal content.',
    },
    {
      q: 'Does a valid digest prove integrity?',
      a: 'Only when the algorithm, value, and message context are trusted and the digest is computed over the exact transmitted representation.',
    },
  ],
  related: ['checksum-validator', 'file-metadata', 'base64'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
