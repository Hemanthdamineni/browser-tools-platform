import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'content-location',
  name: 'Content-Location Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Content-Location resource references.',
  description:
    'Generate or analyze Content-Location values for representation identity and caching diagnostics. Validates relative and absolute URI references, control characters, fragments, and suspicious whitespace without making network requests.',
  keywords: [
    'Content-Location',
    'HTTP representation URL',
    'resource identity header',
    'canonical response URL',
    'URI reference analyzer',
    'cache representation',
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
        { value: 'analyze', label: 'Analyze references' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'location',
      label: 'Location reference',
      type: 'text',
      default: '/representations/en-us.json',
    },
  ],
  examples: [
    { title: 'Analyze representation location', input: '/documents/report.en.html' },
    {
      title: 'Build a response header',
      options: { mode: 'build', location: '/representations/report.en.html' },
    },
    { title: 'Analyze a network-path reference', input: '//cdn.example.com/assets/main.js' },
  ],
  related: ['url-parse', 'http-status', 'cache-headers'],
  status: 'stable',
};
