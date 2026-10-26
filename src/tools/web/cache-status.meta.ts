import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'cache-status',
  name: 'Cache-Status Header Analyzer (RFC 9211)',
  category: 'web',
  summary: 'Analyze RFC 9211 Cache-Status debug fields.',
  description:
    'Analyze the Cache-Status response header defined in RFC 9211 and used by CDNs and proxies to report per-response cache metadata. Recognizes the hit/miss status, ttl, stored, and fwd parameters, validates member grammar, and explains how each parameter informs cache-debugging.',
  keywords: [
    'Cache-Status',
    'RFC 9211',
    'structured field',
    'CDN cache status',
    'cache hit',
    'cache miss',
    'ttl parameter',
    'fwd parameter',
    's-cache',
    'varnish-cache',
    'cache debug header',
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
    { key: 'cc', label: 'cache-name', type: 'text', default: 'CDN' },
    {
      key: 'hit',
      label: 'Result',
      type: 'select',
      default: 'hit',
      choices: [
        { value: 'hit', label: 'hit' },
        { value: 'miss', label: 'miss' },
        { value: 'pass', label: 'pass' },
      ],
    },
    { key: 'ttl', label: 'ttl seconds', type: 'text', default: '' },
    { key: 'fwd', label: 'forwarding reason', type: 'text', default: '' },
  ],
  examples: [
    { title: 'Analyze a CDN headers', input: 'CDN; hit; ttl=60; stored; fwd=urlll' },
    {
      title: 'Build a simple status',
      options: { mode: 'build', cc: 'CDN', hit: 'hit', ttl: '60' },
    },
  ],
  related: ['cache-headers'],
  hidden: true,
  redirectTo: 'cache-headers',
  status: 'stable',
};
