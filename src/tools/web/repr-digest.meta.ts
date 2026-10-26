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
  related: ['http-header-analyzer', 'content-md5'],
  status: 'stable',
};
