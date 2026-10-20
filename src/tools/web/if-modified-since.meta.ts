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
  faq: [
    {
      q: 'What happens when the resource has not changed?',
      a: 'A server may return 304 Not Modified without a response body, allowing the client to reuse its cached representation.',
    },
    {
      q: 'What date format should I send?',
      a: 'Use IMF-fixdate, for example Wed, 21 Oct 2015 07:28:00 GMT. Servers must accept older formats but send the modern form.',
    },
    {
      q: 'Is this as precise as an entity tag?',
      a: 'No. HTTP dates have one-second granularity and can miss changes made within the same second; ETags are generally more reliable.',
    },
  ],
  related: ['conditional-request-headers', 'cache-headers'],
  hidden: true,
  redirectTo: 'conditional-request-headers',
  status: 'stable',
};
