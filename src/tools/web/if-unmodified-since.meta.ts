import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'if-unmodified-since',
  name: 'If-Unmodified-Since Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP If-Unmodified-Since preconditions.',
  description: 'Generate or analyze If-Unmodified-Since HTTP-date preconditions for safe updates and lost-update prevention. Validates IMF-fixdate syntax, identifies obsolete HTTP date forms, checks future dates, and explains 412 behavior locally.',
  keywords: ['If-Unmodified-Since', 'HTTP update precondition', '412 Precondition Failed', 'HTTP-date', 'lost update prevention', 'conditional PUT', 'Last-Modified'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze date' }, { value: 'build', label: 'Build condition' }] },
    { key: 'date', label: 'HTTP date', type: 'text', default: 'Wed, 21 Oct 2015 07:28:00 GMT' },
  ],
  examples: [
    { title: 'Analyze an update precondition', input: 'Wed, 21 Oct 2015 07:28:00 GMT' },
    { title: 'Build a conditional update value', options: { mode: 'build', date: 'Wed, 21 Oct 2015 07:28:00 GMT' } },
  ],
  faq: [
    { q: 'What happens when the resource changed?', a: 'A server commonly returns 412 Precondition Failed instead of applying the update, preventing an accidental overwrite.' },
    { q: 'Is this stronger than If-Match?', a: 'No. Dates have one-second granularity and can miss rapid changes; If-Match with a strong ETag is generally safer for concurrency control.' },
    { q: 'Can I use this with GET?', a: 'It can be sent with several methods, but it is most useful for state-changing requests that must not overwrite a newer representation.' },
  ],
  related: ['if-match', 'if-modified-since', 'etag'],
  hidden: true,
  redirectTo: 'conditional-request-headers',
  status: 'stable',
};
