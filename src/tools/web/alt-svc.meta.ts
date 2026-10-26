import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'alt-svc',
  name: 'Alt-Svc Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Alt-Svc alternate-service advertisements.',
  description:
    'Generate or analyze Alt-Svc values for HTTP/2 and HTTP/3 deployment. Validates protocol identifiers, quoted authorities, max-age and persist parameters, duplicates, and wildcard origin scope locally.',
  keywords: [
    'Alt-Svc',
    'HTTP/3',
    'alternative service',
    'QUIC authority',
    'max-age',
    'persist',
    'HTTP protocol deployment',
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
        { value: 'analyze', label: 'Analyze services' },
        { value: 'build', label: 'Build service' },
      ],
    },
    { key: 'protocol', label: 'Protocol identifier', type: 'text', default: 'h3' },
    { key: 'authority', label: 'Quoted authority', type: 'text', default: ':443' },
    { key: 'maxAge', label: 'max-age seconds', type: 'number', default: 86400, min: 0 },
    { key: 'persist', label: 'persist (optional)', type: 'boolean', default: false },
  ],
  examples: [
    { title: 'Analyze HTTP/3 advertisement', input: 'h3=":443"; ma=86400' },
    {
      title: 'Build an alternate service',
      options: { mode: 'build', protocol: 'h3', authority: ':443', maxAge: 86400 },
    },
  ],
  related: ['http-header-analyzer', 'http-status', 'content-location'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
