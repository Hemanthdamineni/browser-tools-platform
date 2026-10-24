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
  article: [
    {
      heading: 'A message and a shared key, hashed together',
      body: 'Put the message in the main box and the shared secret in the Secret key option and you get a keyed digest over the UTF-8 bytes of both. Pick SHA-1, SHA-256, SHA-384 or SHA-512 and hex or Base64 output; the stats report the key length and the bytes signed.',
    },
    {
      heading: 'The webhook-signature job',
      body: 'Use it to reproduce a signature a provider says it sent: paste the raw request body, paste the signing secret, choose the algorithm the provider documents, and compare your digest with the signature header. Identical digests prove integrity.',
    },
    {
      heading: 'Choosing the algorithm, key and encoding',
      body: 'SHA-256 is the right default for new work; SHA-1 is here for legacy APIs that still demand HMAC-SHA1. The key is passed to Web Crypto as raw UTF-8 bytes, so unusual characters are used exactly as typed. Hex matches most documentation; Base64 is common in HTTP header signatures.',
    },
    {
      heading: 'Caveats that change what it proves',
      body: 'HMAC shows possession of the key and message integrity — it is not encryption, and not a public signature, because verifying it requires the same secret. An empty key is an error and empty input returns empty output; over-long keys are folded down to the block size.',
    },
    {
      heading: 'The secret stays in the tab',
      body: 'Both the message and the key are handled by the Web Crypto API inside your browser and nothing is transmitted. Even so, treat a signing secret as live credentials and clear the key field when you are done.',
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
  faq: [
    {
      q: 'What is HMAC used for?',
      a: 'HMAC proves that a message was produced by someone holding the shared secret key and has not been altered in transit. It is widely used for API request signing and webhook verification.',
    },
    {
      q: 'How is the key interpreted?',
      a: 'The key text is encoded as UTF-8 bytes and used directly as the raw HMAC key. Keys longer than the hash block size are hashed down first by the Web Crypto implementation.',
    },
    {
      q: 'Is HMAC-SHA1 still safe?',
      a: 'HMAC stays secure with SHA-1 far longer than plain SHA-1 does, and some legacy APIs still require it. Prefer HMAC-SHA256 for new systems.',
    },
    {
      q: 'Why is an empty key rejected?',
      a: 'An HMAC with an empty key is a degenerate case that is almost never what a caller intended, and most webhook libraries refuse it too. This tool raises an error asking for a shared secret rather than returning a digest that would not match anything.',
    },
    {
      q: 'What do "key bytes" and "bytes signed" mean?',
      a: 'Key bytes is the length of the UTF-8 encoding of the secret you typed, and bytes signed is the length of the UTF-8 encoding of the message. They are shown so you can see exactly what went into the computation, including any trailing spaces.',
    },
  ],
  related: ['hash', 'crc32', 'file-hash', 'base64'],
  status: 'stable',
};
