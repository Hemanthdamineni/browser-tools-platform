import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'if-modified-since',
  name: 'If-Modified-Since Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP If-Modified-Since cache conditions.',
  description:
    'Generate or analyze If-Modified-Since HTTP-date conditions for cache revalidation. Validates IMF-fixdate syntax, identifies obsolete HTTP date forms, checks future dates, and explains conditional response behavior locally.',
  keywords: [
    'If-Modified-Since',
    'HTTP cache validation',
    '304 Not Modified',
    'HTTP-date',
    'IMF-fixdate',
    'conditional GET',
    'Last-Modified',
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
        { value: 'build', label: 'Build condition' },
      ],
    },
    { key: 'date', label: 'HTTP date', type: 'text', default: 'Wed, 21 Oct 2015 07:28:00 GMT' },
  ],
  examples: [
    { title: 'Analyze a cache condition', input: 'Wed, 21 Oct 2015 07:28:00 GMT' },
    {
      title: 'Build a revalidation condition',
      options: { mode: 'build', date: 'Wed, 21 Oct 2015 07:28:00 GMT' },
    },
  ],
  related: ['conditional-request-headers', 'cache-headers'],
  hidden: true,
  redirectTo: 'conditional-request-headers',
  status: 'stable',
};
