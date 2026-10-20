import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'allow-header',
  name: 'Allow Header Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Allow method lists for API responses.',
  description:
    'Generate or analyze an Allow response header for 405 responses and API documentation. Normalizes standard methods, flags duplicates and invalid tokens, and warns when wildcard or unsafe method declarations are used.',
  keywords: [
    'Allow header',
    'HTTP methods',
    '405 method not allowed',
    'API allowed methods',
    'OPTIONS Allow',
    'HTTP method analyzer',
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
        { value: 'analyze', label: 'Analyze methods' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'methods',
      label: 'Methods (comma-separated)',
      type: 'text',
      default: 'GET, POST, OPTIONS',
    },
  ],
  examples: [
    { title: 'Analyze an API response', input: 'GET, POST, OPTIONS, HEAD' },
    {
      title: 'Build a resource policy',
      options: { mode: 'build', methods: 'GET, PUT, DELETE, OPTIONS' },
    },
  ],
  faq: [
    {
      q: 'What does Allow describe?',
      a: 'It lists methods supported by the target resource, commonly in a 405 Method Not Allowed response. It does not grant permission or bypass authentication.',
    },
    {
      q: 'Should HEAD be listed when GET is supported?',
      a: 'Servers generally support HEAD wherever GET is supported, but explicitly listing it improves clarity and interoperability.',
    },
    {
      q: 'Does this validate an API implementation?',
      a: 'No. It checks header syntax and common method-list concerns only; it cannot test server behavior.',
    },
  ],
  related: ['http-status', 'cors', 'security-headers'],
  status: 'stable',
};
