import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'hmac',
  name: 'HMAC Generator',
  category: 'crypto',
  summary: 'Compute an HMAC of text with a secret key using SHA-1, SHA-256, SHA-384 or SHA-512.',
  description:
    'Generate a keyed hash message authentication code (HMAC) for the input text. Both the message and the key are encoded as UTF-8 and processed with the Web Crypto API.',
  keywords: [
    'hmac',
    'hash mac',
    'message authentication code',
    'hmac-sha256',
    'hmac-sha1',
    'signature',
    'webhook signature',
    'api signing',
    'sha256',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'algorithm',
      label: 'Hash algorithm',
      type: 'select',
      default: 'sha-256',
      choices: [
        { value: 'sha-1', label: 'SHA-1' },
        { value: 'sha-256', label: 'SHA-256' },
        { value: 'sha-384', label: 'SHA-384' },
        { value: 'sha-512', label: 'SHA-512' },
      ],
    },
    {
      key: 'key',
      label: 'Secret key',
      type: 'text',
      default: '',
      placeholder: 'shared secret',
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
  ],
  examples: [
    {
      title: 'HMAC-SHA256',
      input: 'The quick brown fox jumps over the lazy dog',
      options: { algorithm: 'sha-256', key: 'key' },
    },
    {
      title: 'HMAC-SHA1 (legacy APIs)',
      input: 'The quick brown fox jumps over the lazy dog',
      options: { algorithm: 'sha-1', key: 'key' },
    },
    {
      title: 'Base64 output',
      input: 'payload',
      options: { key: 'topsecret', output: 'base64' },
    },
  ],
  related: ['hash', 'crc32', 'file-hash', 'base64'],
  status: 'stable',
};
