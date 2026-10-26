import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'accept-ch',
  name: 'Accept-CH Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP client-hints opt-in values.',
  description:
    'Generate or analyze Accept-CH response values that request browser client hints. Validates hint tokens, detects duplicates and high-entropy privacy-sensitive hints, and explains cache variation and Permissions-Policy considerations.',
  keywords: [
    'Accept-CH',
    'Client Hints',
    'HTTP client hints',
    'sec-ch-ua',
    'device memory',
    'DPR',
    'Permissions-Policy',
    'Vary',
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
        { value: 'analyze', label: 'Analyze hints' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'hints',
      label: 'Hint names (space-separated)',
      type: 'text',
      default: 'Sec-CH-UA, Sec-CH-UA-Mobile, Viewport-Width',
    },
  ],
  examples: [
    { title: 'Analyze requested hints', input: 'Sec-CH-UA, Sec-CH-UA-Mobile, Viewport-Width' },
    {
      title: 'Build a client-hints opt-in',
      options: { mode: 'build', hints: 'Sec-CH-UA Sec-CH-UA-Mobile Viewport-Width' },
    },
  ],
  related: ['cache-headers', 'security-headers', 'content-type'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
