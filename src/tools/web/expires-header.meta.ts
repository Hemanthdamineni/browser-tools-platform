import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'expires-header',
  name: 'Expires Header Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Expires cache timestamps.',
  description: 'Generate or analyze Expires response header values using IMF-fixdate. Validates calendar values, identifies obsolete HTTP date forms, flags past and far-future expiry, and explains precedence with Cache-Control.',
  keywords: ['Expires header', 'HTTP caching', 'HTTP-date', 'IMF-fixdate', 'cache expiration', 'Cache-Control max-age', 'stale response'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze date' }, { value: 'build', label: 'Build date' }] },
    { key: 'date', label: 'Expiration date', type: 'text', default: 'Wed, 21 Oct 2030 07:28:00 GMT' },
  ],
  examples: [
    { title: 'Analyze an expiration date', input: 'Wed, 21 Oct 2030 07:28:00 GMT' },
    { title: 'Build a cache expiration value', options: { mode: 'build', date: 'Wed, 21 Oct 2030 07:28:00 GMT' } },
  ],
  faq: [
    { q: 'Does Expires always control caching?', a: 'No. Cache-Control max-age and s-maxage generally take precedence when present; Expires is a legacy-compatible fallback.' },
    { q: 'What does a past Expires date mean?', a: 'It indicates the response is already stale, though other cache directives and validation rules still affect actual behavior.' },
    { q: 'What format should I send?', a: 'Use IMF-fixdate, for example Wed, 21 Oct 2030 07:28:00 GMT. This tool does not make network requests.' },
  ],
  related: ['cache-headers', 'date-header', 'conditional-request-headers'],
  hidden: true,
  redirectTo: 'cache-headers',
  status: 'stable',
};
