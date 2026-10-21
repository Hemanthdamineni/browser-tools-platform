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
  faq: [
    {
      q: 'How is Last-Modified used?',
      a: 'Clients can send the value in If-Modified-Since to revalidate cached content and potentially receive 304 Not Modified.',
    },
    {
      q: 'Is it as precise as an ETag?',
      a: 'No. Dates have one-second granularity and can miss rapid updates; entity tags are usually stronger validators.',
    },
    {
      q: 'Can the date be in the future?',
      a: 'It should normally reflect the representation’s modification time, so future values often indicate clock skew or bad source metadata.',
    },
  ],
  related: ['conditional-request-headers', 'http-header-analyzer'],
  hidden: true,
  redirectTo: 'conditional-request-headers',
  status: 'stable',
};
