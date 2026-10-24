import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'repr-digest',
  name: 'Repr-Digest Builder & Analyzer',
  category: 'web',
  summary: 'Build or verify modern representation digest fields.',
  description:
    'Compute or analyze the RFC 9530 Repr-Digest field for UTF-8 text using SHA-256 structured-field syntax. Distinguishes representation integrity from message-content integrity and performs all work locally.',
  keywords: [
    'Repr-Digest',
    'representation digest',
    'RFC 9530',
    'SHA-256',
    'structured fields',
    'HTTP integrity',
    'content digest',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'build',
      choices: [
        { value: 'build', label: 'Build digest' },
        { value: 'analyze', label: 'Verify digest' },
      ],
    },
    { key: 'digest', label: 'Expected Repr-Digest', type: 'text', default: '' },
  ],
  article: [
    {
      heading: 'Building and verifying the digest field',
      body: 'This tool computes or checks an RFC 9530 Repr-Digest for UTF-8 text. Build mode returns the field as sha-256=: followed by a base64 SHA-256 value in colons. Verify mode recomputes the digest and compares it with the expected value you supply, reporting Match, Mismatch or Invalid in a small table.',
    },
    {
      heading: 'When a representation digest helps',
      body: 'Reach for it to hand a client a representation hash so it can detect corruption in transit, or to check a Repr-Digest header you received. It also helps debug an integrity mismatch by showing whether the exact text and the header value agree.',
    },
    {
      heading: 'The mode switch and expected value',
      body: 'Mode chooses building or verifying; in verify mode the digest option holds the expected value. The tool first checks that value shape with a strict pattern, reporting Invalid when it is not a well-formed sha-256 field, then compares it byte-for-byte with the computed digest.',
    },
    {
      heading: 'What Repr-Digest does not prove',
      body: 'This tool hashes the UTF-8 bytes of the text you enter, while a real deployment must hash the exact representation bytes its protocol specifies. A digest detects accidental change only and does not authenticate the producer, so use a signature for authenticity. Content-Digest covers message content after codings, which is a different field.',
    },
    {
      heading: 'Where the hash is computed',
      body: 'The hashing runs locally through the browser crypto API. Your text is never uploaded and no request is made, so a digest can be checked offline.',
    },
  ],
  examples: [
    { title: 'Build a representation digest', input: 'Hello, world!' },
    {
      title: 'Verify a representation digest',
      input: 'Hello, world!',
      options: {
        mode: 'analyze',
        digest: 'sha-256=:MVHvdqYQ2WJ6jL3b6h3AqXyS1e5m6lQf7c8d9e0f1g2=:',
      },
    },
    {
      title: 'Verify a mismatching digest',
      input: 'Hello there!',
      options: {
        mode: 'analyze',
        digest: 'sha-256=:MVHvdqYQ2WJ6jL3b6h3AqXyS1e5m6lQf7c8d9e0f1g2=:',
      },
    },
  ],
  faq: [
    {
      q: 'How is Repr-Digest different from Content-Digest?',
      a: 'Repr-Digest identifies the selected representation, while Content-Digest identifies message content after transfer/content codings are considered.',
    },
    {
      q: 'Is this an authenticity signature?',
      a: 'No. A digest detects accidental changes but does not authenticate who produced the representation. Use a signature when authenticity is required.',
    },
    {
      q: 'What bytes are hashed?',
      a: 'This tool hashes the UTF-8 bytes of the entered text. Real deployments must hash the exact representation bytes specified by their protocol.',
    },
  ],
  related: ['http-header-analyzer', 'content-md5'],
  status: 'stable',
};
