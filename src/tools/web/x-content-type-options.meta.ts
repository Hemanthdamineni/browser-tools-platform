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
  ],
  faq: [
    {
      q: 'What does nosniff do?',
      a: 'It tells the browser not to guess a file type from its content; the declared Content-Type is authoritative, reducing drive-by download and injection risk.',
    },
    {
      q: 'Is any other value valid?',
      a: 'Only nosniff is defined. Other values are ignored by browsers and typically indicate a legacy or broken configuration.',
    },
    {
      q: 'When is it required?',
      a: 'It is a recommended security header for any HTML, CSS, or JavaScript delivered to browsers, especially on CDNs and static hosts.',
    },
  ],
  related: ['content-type', 'x-frame-options', 'security-headers'],
  status: 'stable',
};
