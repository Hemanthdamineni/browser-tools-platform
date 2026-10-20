import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'referrer-policy',
  name: 'Referrer-Policy Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect referrer information controls.',
  description:
    'Generate or analyze Referrer-Policy response values. Validates all supported policy tokens, explains how a comma-separated list resolves to the last supported token, and flags unsafe-url and downgrade-leakage risks locally.',
  keywords: [
    'Referrer-Policy',
    'HTTP referrer',
    'no-referrer',
    'strict-origin-when-cross-origin',
    'referrer leakage',
    'downgrade referrer',
    'privacy header',
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
        { value: 'analyze', label: 'Analyze policy' },
        { value: 'build', label: 'Build policy' },
      ],
    },
    {
      key: 'value',
      label: 'Policy',
      type: 'select',
      default: 'strict-origin-when-cross-origin',
      choices: [
        { value: 'no-referrer', label: 'no-referrer' },
        { value: 'no-referrer-when-downgrade', label: 'no-referrer-when-downgrade' },
        { value: 'origin', label: 'origin' },
        { value: 'origin-when-cross-origin', label: 'origin-when-cross-origin' },
        { value: 'same-origin', label: 'same-origin' },
        { value: 'strict-origin', label: 'strict-origin' },
        { value: 'strict-origin-when-cross-origin', label: 'strict-origin-when-cross-origin' },
        { value: 'unsafe-url', label: 'unsafe-url' },
      ],
    },
  ],
  examples: [
    { title: 'Analyze a policy', input: 'strict-origin-when-cross-origin' },
    { title: 'Build a strict policy', options: { mode: 'build', value: 'no-referrer' } },
  ],
  faq: [
    {
      q: 'What is the recommended default?',
      a: 'strict-origin-when-cross-origin is the common recommendation: it sends origins on cross-origin requests and full URLs same-origin.',
    },
    {
      q: 'Why list multiple policies?',
      a: 'The browser applies the last supported token, so a list can express a preferred policy with fallbacks for older browsers.',
    },
    {
      q: 'Why is unsafe-url risky?',
      a: 'It sends full URLs, potentially including paths, queries, or tokens, on cross-origin requests.',
    },
  ],
  related: ['security-headers', 'cross-origin-opener-policy', 'permissions-policy'],
  status: 'stable',
};
