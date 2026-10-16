import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'http-encoding',
  name: 'HTTP Encoding Header Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect Accept-Encoding and Content-Encoding negotiation values.',
  description: 'Parse weighted HTTP content-coding lists, choose the best supported coding, and build Accept-Encoding or Content-Encoding headers. Invalid q-values, wildcards, and disabled codings are reported locally.',
  keywords: ['Accept-Encoding', 'Content-Encoding', 'gzip header', 'br compression', 'deflate header', 'HTTP q value', 'content negotiation'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze preferences' }, { value: 'build', label: 'Build header' }] },
    { key: 'header', label: 'Header', type: 'select', default: 'accept', choices: [{ value: 'accept', label: 'Accept-Encoding' }, { value: 'content', label: 'Content-Encoding' }] },
    { key: 'codings', label: 'Codings (comma-separated)', type: 'text', default: 'br, gzip, deflate' },
    { key: 'supported', label: 'Supported codings (analyze)', type: 'text', default: 'br, gzip, deflate, identity' },
  ],
  examples: [
    { title: 'Analyze browser preferences', input: 'br;q=1.0, gzip;q=0.8, *;q=0.1' },
    { title: 'Build an Accept-Encoding header', options: { mode: 'build', header: 'accept', codings: 'br, gzip, deflate' } },
  ],
  faq: [
    { q: 'What does q mean?', a: 'The q-value expresses relative preference from 0 to 1. A coding with q=0 is explicitly unacceptable.' },
    { q: 'What is identity?', a: 'identity means no content coding. It is generally acceptable unless explicitly assigned q=0 or excluded by a wildcard rule.' },
    { q: 'Does this compress data?', a: 'No. It only builds and analyzes negotiation headers; it never transforms a response body.' },
  ],
  related: ['gzip', 'mime-lookup', 'http-status'],
  status: 'stable',
};
