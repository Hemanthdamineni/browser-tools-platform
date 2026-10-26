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
    {
      title: 'Build Basic credentials from a user name',
      options: { mode: 'build', scheme: 'Basic', username: 'user', password: 'pass' },
    },
  ],
  related: ['proxy-authenticate', 'basic-auth', 'secret-scanner'],
  status: 'stable',
};
