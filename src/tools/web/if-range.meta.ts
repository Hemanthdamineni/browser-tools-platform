import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'if-range',
  name: 'If-Range Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP If-Range validators for partial responses.',
  description:
    'Generate or analyze If-Range values used with Range requests. Validates strong entity-tags and IMF-fixdates, rejects weak tags, and explains whether a server may send 206 Partial Content or the full representation.',
  keywords: [
    'If-Range',
    'HTTP Range',
    '206 Partial Content',
    'strong ETag',
    'HTTP-date',
    'resume download',
    'conditional range request',
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
        { value: 'analyze', label: 'Analyze validator' },
        { value: 'build', label: 'Build validator' },
      ],
    },
    { key: 'validator', label: 'Entity tag or HTTP date', type: 'text', default: '"v1-abc123"' },
  ],
  examples: [
    { title: 'Analyze a resume-download validator', input: '"v1-abc123"' },
    {
      title: 'Build a date validator',
      options: { mode: 'build', validator: 'Wed, 21 Oct 2015 07:28:00 GMT' },
    },
  ],
  related: ['http-range', 'conditional-request-headers'],
  hidden: true,
  redirectTo: 'conditional-request-headers',
  status: 'stable',
};
