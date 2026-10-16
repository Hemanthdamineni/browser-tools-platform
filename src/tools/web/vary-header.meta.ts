import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'vary-header',
  name: 'Vary Header Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Vary cache-key fields.',
  description: 'Generate or analyze Vary response headers that tell caches which request fields change a response. Validates field-name tokens, wildcard usage, duplicates, and common cache pitfalls entirely on-device.',
  keywords: ['Vary header', 'HTTP cache key', 'Vary Accept-Encoding', 'Vary Origin', 'cache variation', 'Vary header analyzer'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze fields' }, { value: 'build', label: 'Build header' }] },
    { key: 'fields', label: 'Request fields (comma-separated)', type: 'text', default: 'Accept-Encoding, Origin' },
  ],
  examples: [
    { title: 'Analyze cache variation', input: 'Accept-Encoding, Origin' },
    { title: 'Build a compression-aware policy', options: { mode: 'build', fields: 'Accept-Encoding, Accept-Language' } },
  ],
  faq: [
    { q: 'What does Vary do?', a: 'It tells a cache that response selection depends on listed request header fields, so those values belong in the cache key.' },
    { q: 'What does Vary: * mean?', a: 'It indicates the response is not suitable for normal cache reuse and is effectively uncacheable by shared caches.' },
    { q: 'Should Vary include Authorization?', a: 'Usually private or authenticated responses need stronger cache controls. Vary alone is not an authorization boundary and cannot make unsafe content safe to cache.' },
  ],
  related: ['cache-control', 'security-headers', 'http-encoding'],
  status: 'stable',
};
