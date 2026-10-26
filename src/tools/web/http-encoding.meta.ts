import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'http-encoding',
  name: 'HTTP Encoding Header Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect Accept-Encoding and Content-Encoding negotiation values.',
  description:
    'Parse weighted HTTP content-coding lists, choose the best supported coding, and build Accept-Encoding or Content-Encoding headers. Invalid q-values, wildcards, and disabled codings are reported locally.',
  keywords: [
    'Accept-Encoding',
    'Content-Encoding',
    'gzip header',
    'br compression',
    'deflate header',
    'HTTP q value',
    'content negotiation',
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
        { value: 'analyze', label: 'Analyze preferences' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'header',
      label: 'Header',
      type: 'select',
      default: 'accept',
      choices: [
        { value: 'accept', label: 'Accept-Encoding' },
        { value: 'content', label: 'Content-Encoding' },
      ],
    },
    {
      key: 'codings',
      label: 'Codings (comma-separated)',
      type: 'text',
      default: 'br, gzip, deflate',
    },
    {
      key: 'supported',
      label: 'Supported codings (analyze)',
      type: 'text',
      default: 'br, gzip, deflate, identity',
    },
  ],
  examples: [
    { title: 'Analyze browser preferences', input: 'br;q=1.0, gzip;q=0.8, *;q=0.1' },
    {
      title: 'Build an Accept-Encoding header',
      options: { mode: 'build', header: 'accept', codings: 'br, gzip, deflate' },
    },
    {
      title: 'Build a Content-Encoding header',
      options: { mode: 'build', header: 'content', codings: 'gzip' },
    },
  ],
  related: ['gzip', 'mime-lookup', 'http-status'],
  status: 'stable',
};
