import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'authentication-info',
  name: 'Authentication-Info Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Authentication-Info parameters.',
  description:
    'Generate or analyze Authentication-Info response parameters used by Digest authentication. Validates tokens, quoted values, nextnonce, rspauth, and nonce-count fields locally without handling credentials or making requests.',
  keywords: [
    'Authentication-Info',
    'Digest authentication',
    'nextnonce',
    'rspauth',
    'nonce-count',
    'HTTP auth response',
    'authentication parameters',
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
        { value: 'analyze', label: 'Analyze parameters' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'parameter',
      label: 'Parameter',
      type: 'select',
      default: 'nextnonce',
      choices: [
        { value: 'nextnonce', label: 'nextnonce' },
        { value: 'rspauth', label: 'rspauth' },
        { value: 'nc', label: 'nc' },
      ],
    },
    { key: 'value', label: 'Value', type: 'text', default: '"nonce-value"' },
  ],
  examples: [
    {
      title: 'Analyze Digest response info',
      input: 'nextnonce="server-nonce", rspauth="abc123", nc=00000001',
    },
    {
      title: 'Build a nextnonce field',
      options: { mode: 'build', parameter: 'nextnonce', value: '"server-nonce"' },
    },
  ],
  faq: [
    {
      q: 'Does Authentication-Info contain credentials?',
      a: 'It carries response-side Digest authentication parameters, not the user password. Still avoid pasting live production nonces or tokens into shared environments.',
    },
    {
      q: 'What is nextnonce?',
      a: 'It lets a server provide a nonce for a subsequent authenticated request, reducing the need for another challenge.',
    },
    {
      q: 'Does this verify rspauth?',
      a: 'No. It validates field syntax only and cannot verify a response digest without the request context and secret.',
    },
  ],
  related: ['www-authenticate', 'basic-auth', 'secret-scanner'],
  status: 'stable',
};
