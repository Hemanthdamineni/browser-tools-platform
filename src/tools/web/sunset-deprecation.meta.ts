import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'sunset-deprecation',
  name: 'Sunset & Deprecation Header Analyzer',
  category: 'web',
  summary: 'Build or inspect API lifecycle deprecation signals.',
  description:
    'Generate or analyze Sunset (RFC 8594) and Deprecation (RFC 9742) response headers for API lifecycle management. Validates IMF-fixdate dates on both, flags past or distant timestamps, and checks for optional Link relationships.',
  keywords: [
    'Sunset header',
    'Deprecation header',
    'API lifecycle',
    'deprecation notice',
    'IMF-fixdate',
    'Link header',
    'API retirement',
    'rfc 8594',
    'rfc 9742',
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
    {
      key: 'header',
      label: 'Header',
      type: 'select',
      default: 'sunset',
      choices: [
        { value: 'sunset', label: 'Sunset' },
        { value: 'deprecation', label: 'Deprecation' },
      ],
    },
    {
      key: 'date',
      label: 'Date (IMF-fixdate)',
      type: 'text',
      default: 'Wed, 15 Mar 2028 00:00:00 GMT',
    },
    { key: 'link', label: 'Link URL (optional)', type: 'text', default: '' },
  ],
  examples: [
    { title: 'Analyze a Sunset header', input: 'Sunset: Wed, 15 Mar 2028 00:00:00 GMT' },
    {
      title: 'Build a deprecation header',
      options: {
        mode: 'build',
        header: 'deprecation',
        date: 'Wed, 15 Mar 2028 00:00:00 GMT',
        link: 'https://api.example.com/docs/deprecation',
      },
    },
  ],
  faq: [
    {
      q: 'What do Sunset and Deprecation do?',
      a: 'They communicate the end-of-life or deprecation date of an API resource to clients, replacing ad-hoc documentation-only notices.',
    },
    {
      q: 'How do they differ?',
      a: 'Sunset announces when a served resource will stop being available; Deprecation indicates the resource is deprecated but still functional.',
    },
    {
      q: 'Why include a Link?',
      a: 'A Link header (or Link parameter) can point clients to migration or replacement documentation for the deprecated resource.',
    },
  ],
  related: ['http-header-analyzer', 'http-status'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
