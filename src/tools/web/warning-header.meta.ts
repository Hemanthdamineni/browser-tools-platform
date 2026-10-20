import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'warning-header',
  name: 'Warning Header Analyzer',
  category: 'web',
  summary: 'Decode Warning response-header codes (RFC 7234).',
  description:
    'Analyze the HTTP Warning response header, a structured field that carries advisory information (RFC 7234 §5.5) such as cache-staleness codes 110–113 and the catch-all 199/299 warnings. Validates the warn-code, agent, text, and timestamp grammar and explains each meaning.',
  keywords: [
    'Warning header',
    'warn-code',
    'HTTP Warning',
    'RFC 7234',
    'cache warning',
    '110 Response is Stale',
    '111 Revalidation Failed',
    '112 Heuristic Expiration',
    '113 Heuristic Expiration',
    'warning agent',
    'warn-text',
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
        { value: 'analyze', label: 'Analyze header' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'code',
      label: 'Warn-code',
      type: 'select',
      default: '110',
      choices: [
        { value: '110', label: '110 Response is Stale' },
        { value: '111', label: '111 Revalidation Failed' },
        { value: '112', label: '112 Disconnected Operation' },
        { value: '113', label: '113 Heuristic Expiration' },
        { value: '199', label: '199 Miscellaneous Warning' },
        { value: '299', label: '299 Miscellaneous Persistent Warning' },
      ],
    },
    { key: 'agent', label: 'Agent', type: 'text', default: '-' },
    { key: 'text', label: 'Text', type: 'text', default: 'Response is Stale' },
  ],
  examples: [
    { title: 'Analyze a cache warning', input: '110 - "Response is Stale"' },
    {
      title: 'Build a warning header',
      options: { mode: 'build', code: '111', agent: 'cache', text: 'Revalidation Failed' },
    },
  ],
  faq: [
    {
      q: 'What does Warning carry?',
      a: 'A warn-code (a 3-digit integer), warn-agent, warn-text in quotes, and an optional warn-date — all per RFC 7234.',
    },
    {
      q: 'Why is Warning obsolete?',
      a: 'The header was deprecated in later specs, but some caches still emit the 1xx/2xx codes, so tools often must recognize them.',
    },
    {
      q: 'How do I compare codes?',
      a: 'Codes from 100–199 relate to the current response only; 200–299 persist across caches. Lower is generally more informative.',
    },
  ],
  related: ['cache-headers', 'proxy-status'],
  status: 'stable',
};
