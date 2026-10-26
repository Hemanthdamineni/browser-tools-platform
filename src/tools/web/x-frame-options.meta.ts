import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'x-frame-options',
  name: 'X-Frame-Options Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect clickjacking frame controls.',
  description:
    'Generate or analyze the X-Frame-Options response header. Validates DENY and SAMEORIGIN values, flags the deprecated ALLOW-FROM form, and explains the interplay with CSP frame-ancestors for modern framing protection.',
  keywords: [
    'X-Frame-Options',
    'XFO',
    'clickjacking',
    'DENY',
    'SAMEORIGIN',
    'frame-ancestors',
    'framing protection',
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
        { value: 'analyze', label: 'Analyze value' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'value',
      label: 'Policy',
      type: 'select',
      default: 'DENY',
      choices: [
        { value: 'DENY', label: 'DENY' },
        { value: 'SAMEORIGIN', label: 'SAMEORIGIN' },
      ],
    },
  ],
  examples: [
    { title: 'Analyze framing behavior', input: 'SAMEORIGIN' },
    { title: 'Build a strict frame policy', options: { mode: 'build', value: 'DENY' } },
    { title: 'Inspect an ALLOW-FROM value', input: 'ALLOW-FROM https://example.com' },
  ],
  related: ['security-headers', 'content-security-policy', 'permissions-policy'],
  status: 'stable',
};
