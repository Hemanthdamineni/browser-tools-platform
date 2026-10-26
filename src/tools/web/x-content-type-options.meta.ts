import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'x-content-type-options',
  name: 'X-Content-Type-Options Analyzer',
  category: 'web',
  summary: 'Validate X-Content-Type-Options: nosniff.',
  description:
    'Analyze or generate the X-Content-Type-Options response header. Validates the nosniff directive, flags deprecated or non-standard values, and explains how nosniff prevents MIME-type sniffing as recommended by Mozilla and OWASP.',
  keywords: [
    'X-Content-Type-Options',
    'nosniff',
    'MIME sniffing',
    'content type sniffing',
    'security headers',
    'XCTO',
    'browser sniffing protection',
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
        { value: 'analyze', label: 'Analyze value' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'value',
      label: 'Value',
      type: 'select',
      default: 'nosniff',
      choices: [
        { value: 'nosniff', label: 'nosniff' },
        { value: 'none', label: '(unsafe — disable) ' },
      ],
    },
  ],
  examples: [
    { title: 'Analyze a nosniff header', input: 'X-Content-Type-Options: nosniff' },
    { title: 'Build the security header', options: { mode: 'build', value: 'nosniff' } },
    {
      title: 'Analyze a non-standard value',
      input: 'nosniff; something',
    },
  ],
  related: ['content-type', 'x-frame-options', 'security-headers'],
  status: 'stable',
};
