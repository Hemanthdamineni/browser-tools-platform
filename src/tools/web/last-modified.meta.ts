import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'last-modified',
  name: 'Last-Modified Header Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Last-Modified resource timestamps.',
  description:
    'Generate or analyze Last-Modified response header values using IMF-fixdate. Validates calendar values, flags future or obsolete timestamps, and explains cache revalidation precision and clock-skew caveats locally.',
  keywords: [
    'Last-Modified',
    'HTTP-date',
    'IMF-fixdate',
    'cache revalidation',
    'resource timestamp',
    'If-Modified-Since',
    'HTTP caching',
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
    {
      key: 'date',
      label: 'Last-modified date',
      type: 'text',
      default: 'Wed, 21 Oct 2015 07:28:00 GMT',
    },
  ],
  examples: [
    { title: 'Analyze resource timestamp', input: 'Wed, 21 Oct 2015 07:28:00 GMT' },
    {
      title: 'Build a response timestamp',
      options: { mode: 'build', date: 'Wed, 21 Oct 2015 07:28:00 GMT' },
    },
  ],
  related: ['conditional-request-headers', 'http-header-analyzer'],
  hidden: true,
  redirectTo: 'conditional-request-headers',
  status: 'stable',
};
