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
    {
      title: 'Check a nonce count value',
      input: 'nc=0000002a',
    },
  ],
  related: ['www-authenticate', 'basic-auth', 'secret-scanner'],
  status: 'stable',
};
