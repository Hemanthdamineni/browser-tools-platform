import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'link-header',
  name: 'HTTP Link Header Builder & Parser',
  category: 'web',
  summary: 'Build or inspect HTTP Link headers for preload, canonical, pagination, and alternates.',
  description:
    'Generate a Link response header from a target URI and relation, or parse pasted Link header values into inspectable URI and parameter rows. Processing stays in your browser.',
  keywords: [
    'HTTP Link header',
    'rel preload',
    'canonical Link header',
    'pagination link',
    'RFC 8288',
    'alternate link',
    'Link header parser',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'parse',
      choices: [
        { value: 'parse', label: 'Parse headers' },
        { value: 'build', label: 'Build header' },
      ],
    },
    { key: 'uri', label: 'Target URI', type: 'text', default: 'https://example.com/resource' },
    { key: 'relation', label: 'Relation', type: 'text', default: 'preload' },
    { key: 'as', label: 'as parameter (optional)', type: 'text', default: '' },
    { key: 'type', label: 'type parameter (optional)', type: 'text', default: '' },
    {
      key: 'crossorigin',
      label: 'crossorigin (optional)',
      type: 'select',
      default: '',
      choices: [
        { value: '', label: 'none' },
        { value: 'anonymous', label: 'anonymous' },
        { value: 'use-credentials', label: 'use-credentials' },
      ],
    },
  ],
  examples: [
    {
      title: 'Build a preload link',
      options: {
        mode: 'build',
        uri: '/fonts/app.woff2',
        relation: 'preload',
        as: 'font',
        type: 'font/woff2',
        crossorigin: 'anonymous',
      },
    },
    { title: 'Parse links', input: '<https://example.com>; rel="canonical", </next>; rel="next"' },
  ],
  faq: [
    {
      q: 'Does this fetch or verify the linked URI?',
      a: 'No. It only formats and parses header text locally and makes no network requests.',
    },
    {
      q: 'Can a Link header replace an HTML link element?',
      a: 'Some relations and user agents support HTTP Link headers, but support and behavior vary. Verify the target browsers and deployment path.',
    },
    {
      q: 'Why are multiple relations sometimes space-separated?',
      a: 'RFC-style Link values can have a relation type list such as rel="alternate stylesheet". The parser preserves the value and reports duplicate relation tokens.',
    },
  ],
  related: ['content-disposition', 'url-parse', 'http-status'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
