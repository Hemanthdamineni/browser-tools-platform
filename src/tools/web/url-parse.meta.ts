import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'url-parse',
  name: 'URL Parser',
  category: 'web',
  summary: 'Break a URL into protocol, host, path, query parameters and hash.',
  description:
    'Paste any URL (absolute, or relative with a base) to see every component: scheme, credentials, host, port, origin, path (raw and decoded), each query parameter and the fragment. Repeated parameter keys are listed individually.',
  keywords: [
    'url parser',
    'parse url',
    'query string',
    'query parameters',
    'url components',
    'split url',
    'url inspector',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'base',
      label: 'Base URL (for relative input)',
      type: 'text',
      default: '',
      placeholder: 'https://example.com',
      help: 'Optional base URL to resolve a relative input against.',
    },
  ],
  examples: [
    {
      title: 'Absolute URL',
      input: 'https://a:b@ex.com:8443/p/q?x=1&x=2&y=hi#frag',
    },
    { title: 'Relative URL with base', input: '/a/b', options: { base: 'https://ex.com' } },
  ],
  faq: [
    {
      q: 'Why does the port row disappear for https://ex.com?',
      a: 'The URL API returns an empty port string when the URL uses the scheme’s default port (443 for https, 80 for http). That is the standards-compliant answer, not a parsing bug.',
    },
  ],
  related: ['querystring', 'basic-auth', 'utm-builder', 'punycode'],
  status: 'stable',
};
