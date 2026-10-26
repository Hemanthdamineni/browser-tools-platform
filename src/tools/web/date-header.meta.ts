import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'date-header',
  name: 'Date Header Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Date response timestamps.',
  description:
    'Generate or analyze HTTP Date response header values using IMF-fixdate. Validates calendar values, flags obsolete HTTP date forms and clock-skew risks, and explains why accurate server time matters for caches and signatures.',
  keywords: [
    'Date header',
    'HTTP-date',
    'IMF-fixdate',
    'server clock skew',
    'HTTP response timestamp',
    'cache age',
    'HTTP headers',
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
        { value: 'analyze', label: 'Analyze date' },
        { value: 'build', label: 'Build date' },
      ],
    },
    { key: 'date', label: 'HTTP date', type: 'text', default: 'Wed, 21 Oct 2015 07:28:00 GMT' },
  ],
  examples: [
    { title: 'Analyze response time', input: 'Wed, 21 Oct 2015 07:28:00 GMT' },
    {
      title: 'Build a response timestamp',
      options: { mode: 'build', date: 'Wed, 21 Oct 2015 07:28:00 GMT' },
    },
  ],
  related: ['conditional-request-headers', 'cache-headers'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
