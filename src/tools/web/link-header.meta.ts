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
  related: ['content-disposition', 'url-parse', 'http-status'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
