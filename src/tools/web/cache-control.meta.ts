import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'cache-control',
  name: 'Cache-Control Builder & Analyzer',
  category: 'web',
  summary: 'Build or review HTTP Cache-Control directives for browser and CDN caching.',
  description: 'Generate a Cache-Control header from directives, or analyze pasted headers for contradictory directives, invalid values, and risky caching of private or sensitive responses. Everything runs locally.',
  keywords: ['cache-control builder', 'cache header analyzer', 'HTTP caching', 'CDN cache header', 'no-store', 'max-age', 's-maxage', 'stale-while-revalidate'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze headers' }, { value: 'build', label: 'Build header' }] },
    { key: 'maxAge', label: 'max-age seconds (0 = omit)', type: 'number', default: 0, min: 0 },
    { key: 'sMaxAge', label: 's-maxage seconds (0 = omit)', type: 'number', default: 0, min: 0 },
    { key: 'visibility', label: 'Visibility', type: 'select', default: 'public', choices: ['public', 'private'].map((value) => ({ value, label: value })) },
    { key: 'noStore', label: 'no-store', type: 'boolean', default: false },
    { key: 'noCache', label: 'no-cache', type: 'boolean', default: false },
    { key: 'mustRevalidate', label: 'must-revalidate', type: 'boolean', default: false },
    { key: 'immutable', label: 'immutable', type: 'boolean', default: false },
    { key: 'staleWhileRevalidate', label: 'stale-while-revalidate seconds (0 = omit)', type: 'number', default: 0, min: 0 },
  ],
  examples: [
    { title: 'Analyze a response policy', input: 'public, max-age=31536000, immutable' },
    { title: 'Build private no-store policy', options: { mode: 'build', visibility: 'private', noStore: true, noCache: true, mustRevalidate: true } },
  ],
  faq: [
    { q: 'Does no-cache mean do not store?', a: 'No. no-cache allows storage but requires validation before reuse. Use no-store when a response must not be stored.' },
    { q: 'What is s-maxage?', a: 's-maxage sets a freshness lifetime for shared caches such as CDNs and overrides max-age there. It does not by itself prevent browser caching.' },
    { q: 'Can this know whether a response is safe to cache?', a: 'No. It can flag suspicious combinations such as public caching with sensitive-looking headers, but cache safety depends on content, authorization, and deployment context.' },
  ],
  related: ['security-headers', 'content-disposition', 'http-status'],
  status: 'stable',
};
