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
  faq: [
    {
      q: 'Why does Date matter?',
      a: 'Caches use response dates with Age and freshness metadata, and operational tooling uses them to diagnose server clock skew.',
    },
    {
      q: 'Should every response include Date?',
      a: 'Origin servers generally send it for responses except some status and protocol-specific cases; intermediaries may add or update it according to HTTP rules.',
    },
    {
      q: 'Does this measure my server clock?',
      a: 'No. It only validates a pasted value or formats a supplied date string; it makes no network request.',
    },
  ],
  related: ['conditional-request-headers', 'cache-headers'],
  status: 'stable',
};
