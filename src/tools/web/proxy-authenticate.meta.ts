import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'proxy-authenticate',
  name: 'Proxy-Authenticate Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP proxy authentication challenges.',
  description: 'Generate or analyze Proxy-Authenticate challenges for forward proxies. Supports Basic and Bearer realms plus Bearer scope and error parameters, validates quoted values, and distinguishes proxy authentication from origin authentication.',
  keywords: ['Proxy-Authenticate', '407 Proxy Authentication Required', 'forward proxy', 'Basic proxy auth', 'Bearer proxy auth', 'proxy challenge'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze challenge' }, { value: 'build', label: 'Build challenge' }] },
    { key: 'scheme', label: 'Scheme', type: 'select', default: 'Basic', choices: [{ value: 'Basic', label: 'Basic' }, { value: 'Bearer', label: 'Bearer' }] },
    { key: 'realm', label: 'Realm', type: 'text', default: 'proxy' },
    { key: 'scope', label: 'Bearer scope (optional)', type: 'text', default: '' },
  ],
  examples: [
    { title: 'Analyze a proxy challenge', input: 'Basic realm="corp-proxy"' },
    { title: 'Build a Bearer proxy challenge', options: { mode: 'build', scheme: 'Bearer', realm: 'edge-proxy', scope: 'connect' } },
  ],
  faq: [
    { q: 'When is Proxy-Authenticate used?', a: 'A forward proxy can send it with 407 Proxy Authentication Required to request proxy credentials from the client.' },
    { q: 'Is it the same as WWW-Authenticate?', a: 'No. Proxy-Authenticate applies to the next proxy, while WWW-Authenticate challenges the origin server.' },
    { q: 'Is Basic safe over HTTP?', a: 'Basic credentials are only Base64-encoded. Use TLS and prefer stronger schemes where available.' },
  ],
  related: ['www-authenticate', 'basic-auth', 'security-headers'],
  status: 'stable',
};
