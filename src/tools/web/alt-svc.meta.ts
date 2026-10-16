import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'alt-svc',
  name: 'Alt-Svc Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Alt-Svc alternate-service advertisements.',
  description: 'Generate or analyze Alt-Svc values for HTTP/2 and HTTP/3 deployment. Validates protocol identifiers, quoted authorities, max-age and persist parameters, duplicates, and wildcard origin scope locally.',
  keywords: ['Alt-Svc', 'HTTP/3', 'alternative service', 'QUIC authority', 'max-age', 'persist', 'HTTP protocol deployment'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze services' }, { value: 'build', label: 'Build service' }] },
    { key: 'protocol', label: 'Protocol identifier', type: 'text', default: 'h3' },
    { key: 'authority', label: 'Quoted authority', type: 'text', default: ':443' },
    { key: 'maxAge', label: 'max-age seconds', type: 'number', default: 86400, min: 0 },
    { key: 'persist', label: 'persist (optional)', type: 'boolean', default: false },
  ],
  examples: [
    { title: 'Analyze HTTP/3 advertisement', input: 'h3=":443"; ma=86400' },
    { title: 'Build an alternate service', options: { mode: 'build', protocol: 'h3', authority: ':443', maxAge: 86400 } },
  ],
  faq: [
    { q: 'Does Alt-Svc redirect a request?', a: 'No. It advertises an alternative connection route; clients may continue using the origin and can fall back if the alternative fails.' },
    { q: 'What does ma mean?', a: 'ma is the freshness lifetime in seconds for the alternate-service mapping.' },
    { q: 'Does this test HTTP/3 connectivity?', a: 'No. It validates field syntax locally and never makes a network request.' },
  ],
  related: ['upgrade-header', 'http-status', 'content-location'],
  status: 'stable',
};
