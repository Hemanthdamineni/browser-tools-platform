import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'trailer-header',
  name: 'Trailer Header Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Trailer field-name declarations.',
  description:
    'Generate or analyze Trailer response declarations for fields delivered after the message body. Validates HTTP field-name tokens, detects duplicates, and flags fields that must not be sent as trailers locally.',
  keywords: [
    'Trailer header',
    'HTTP trailing headers',
    'chunked trailers',
    'trailer field names',
    'HTTP streaming',
    'Transfer-Encoding trailer',
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
        { value: 'analyze', label: 'Analyze fields' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'fields',
      label: 'Trailer fields (comma-separated)',
      type: 'text',
      default: 'Checksum, Server-Timing',
    },
  ],
  examples: [
    { title: 'Analyze trailer declarations', input: 'Checksum, Server-Timing' },
    {
      title: 'Build a streaming response declaration',
      options: { mode: 'build', fields: 'Digest, Server-Timing' },
    },
  ],
  faq: [
    {
      q: 'Does Trailer contain trailing values?',
      a: 'No. It lists field names that may appear after the body. The actual values arrive in trailing headers.',
    },
    {
      q: 'Which fields cannot be trailers?',
      a: 'Routing, framing, authentication, representation-control, and some processing-sensitive fields must not be sent as trailers. Confirm constraints for your HTTP version and intermediary.',
    },
    {
      q: 'Does this enable chunked encoding?',
      a: 'No. It only builds the declaration. Streaming and transfer framing remain server responsibilities.',
    },
  ],
  related: ['http-header-analyzer', 'http-range'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
