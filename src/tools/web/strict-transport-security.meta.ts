import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'strict-transport-security',
  name: 'Strict-Transport-Security (HSTS) Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HSTS policies.',
  description: 'Generate or analyze Strict-Transport-Security header values. Validates max-age, includeSubDomains, and preload directives, detects duplicate tokens, and flags short max-age durations and preload submissions that omit includeSubDomains.',
  keywords: ['Strict-Transport-Security', 'HSTS', 'max-age', 'includeSubDomains', 'preload', 'HTTPS enforcement', 'transport security'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze policy' }, { value: 'build', label: 'Build policy' }] },
    { key: 'maxAge', label: 'max-age (seconds)', type: 'text', default: '31536000' },
    { key: 'flags', label: 'Directives', type: 'select', default: 'includeSubDomains', choices: [{ value: 'none', label: 'basic headers' }, { value: 'includeSubDomains', label: 'include subdomains' }, { value: 'includeSubDomains+preload', label: 'subdomains and preload' }] },
  ],
  examples: [
    { title: 'Analyze an HSTS policy', input: 'max-age=31536000; includeSubDomains; preload' },
    { title: 'Build a preload-ready policy', options: { mode: 'build', maxAge: '31536000', flags: 'includeSubDomains+preload' } },
  ],
  faq: [
    { q: 'What does HSTS do?', a: 'It tells the browser to only use HTTPS for the origin (and subdomains when includeSubDomains is set), preventing protocol-downgrade attacks after the first visit.' },
    { q: 'Can I reduce max-age later?', a: 'max-age=0 revokes HSTS for the requesting browser, but clients that already cached the policy must honor it until it expires.' },
    { q: 'What is required for the preload list?', a: 'Chrome\'s HSTS preload submissions require max-age of at least 31,536,000 seconds (one year) and includeSubDomains.' },
  ],
  related: ['security-headers', 'upgrade-header', 'expect-header'],
  status: 'stable',
};
