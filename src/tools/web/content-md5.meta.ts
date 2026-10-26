import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'content-md5',
  name: 'Content-MD5 Builder & Analyzer',
  category: 'web',
  summary: 'Build or verify legacy Content-MD5 integrity values — the header is deprecated.',
  description:
    'Compute or analyze the legacy Content-MD5 HTTP header for text using standard Base64 MD5. The header is deprecated (RFC 7231 §3.3.2), so this is only useful for interoperability audits: MD5 is collision-weak and the header is not a signature. Use Content-Digest or a cryptographic signature instead.',
  keywords: [
    'Content-MD5',
    'MD5 Base64',
    'HTTP integrity',
    'legacy HTTP header',
    'content checksum',
    'message digest',
    'integrity audit',
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
    { key: 'digest', label: 'Expected Content-MD5 (Base64)', type: 'text', default: '' },
  ],
  examples: [
    { title: 'Build a digest', input: 'Hello, world!' },
    {
      title: 'Verify a digest',
      input: 'Hello, world!',
      options: { mode: 'analyze', digest: 'bNNVbesNpUvKBgtMOUeYOQ==' },
    },
    { title: 'Build a digest for an API body', input: '{"order":42}', options: { mode: 'build' } },
  ],
  related: ['http-header-analyzer', 'checksum-validator', 'hash'],
  status: 'stable',
};
