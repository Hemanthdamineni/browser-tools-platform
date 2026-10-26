import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'origin-header',
  name: 'Origin Request Header Analyzer',
  category: 'web',
  summary: 'Validate the Origin request header for CORS and CSRF.',
  description:
    'Analyze the Origin request header used by cross-origin and same-origin requests. Validates the single-origin grammar (scheme://host[:port] or the literal null), flags trailing slashes, paths, credentials, and empty hosts, and explains the header role in CORS flow and CSRF protections.',
  keywords: [
    'Origin header',
    'origin request header',
    'null origin',
    'single origin',
    'cross-origin',
    'CSRF origin check',
    'same-origin',
    'scheme host port',
    'Origin null',
    'CORS origin',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  examples: [
    { title: 'Analyze a cross-origin request', input: 'Origin: https://app.example.com' },
    { title: 'Analyze the null origin', input: 'Origin: null' },
  ],
  related: ['cors-headers', 'sec-fetch-inspector', 'basic-auth'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
