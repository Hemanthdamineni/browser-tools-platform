import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'proxy-authorization',
  name: 'Proxy-Authorization Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP proxy credential values.',
  description:
    'Generate or analyze Proxy-Authorization credentials for forward proxies. Supports Basic Base64 credentials and Bearer tokens, validates syntax and control characters, and highlights TLS and secret-handling risks locally.',
  keywords: [
    'Proxy-Authorization',
    '407 proxy credentials',
    'forward proxy auth',
    'Basic proxy credentials',
    'Bearer proxy token',
    'proxy header',
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
        { value: 'analyze', label: 'Analyze credentials' },
        { value: 'build', label: 'Build credentials' },
      ],
    },
    {
      key: 'scheme',
      label: 'Scheme',
      type: 'select',
      default: 'Basic',
      choices: [
        { value: 'Basic', label: 'Basic' },
        { value: 'Bearer', label: 'Bearer' },
      ],
    },
    { key: 'username', label: 'Username', type: 'text', default: '' },
    { key: 'password', label: 'Password', type: 'text', default: '' },
    { key: 'token', label: 'Bearer token', type: 'text', default: '' },
  ],
  examples: [
    { title: 'Analyze a proxy credential', input: 'Basic dXNlcjpwYXNz' },
    {
      title: 'Build a Bearer proxy credential',
      options: { mode: 'build', scheme: 'Bearer', token: 'proxy-token' },
    },
  ],
  faq: [
    {
      q: 'Is Proxy-Authorization the same as Authorization?',
      a: 'No. Proxy-Authorization supplies credentials to a forward proxy, while Authorization supplies credentials to the origin server.',
    },
    {
      q: 'Is Basic encoding encryption?',
      a: 'No. Base64 is reversible encoding. Use TLS and avoid logging or sharing generated credentials.',
    },
    {
      q: 'Does this contact a proxy?',
      a: 'No. The tool only formats and validates values locally and never sends credentials over the network.',
    },
  ],
  related: ['proxy-authenticate', 'basic-auth', 'secret-scanner'],
  status: 'stable',
};
