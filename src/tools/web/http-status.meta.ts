import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'http-status',
  name: 'HTTP Status Code Reference',
  category: 'web',
  summary: 'Look up HTTP status codes — what they mean and when APIs return them.',
  description:
    'Enter a status code (404) or a keyword (teapot, redirect) to see the official name and a plain-language meaning. Leave empty to browse every standard code, filtered by class (1xx–5xx).',
  keywords: [
    'http status',
    'status codes',
    '404',
    '418',
    '429',
    'http response codes',
    'status code reference',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'category',
      label: 'Class (empty input only)',
      type: 'select',
      default: 'all',
      choices: [
        { value: 'all', label: 'All' },
        { value: '1xx', label: '1xx Informational' },
        { value: '2xx', label: '2xx Success' },
        { value: '3xx', label: '3xx Redirection' },
        { value: '4xx', label: '4xx Client error' },
        { value: '5xx', label: '5xx Server error' },
      ],
    },
  ],
  examples: [
    { title: '404', input: '404' },
    { title: 'Teapot', input: 'teapot' },
    { title: 'Browse all' },
  ],
  related: ['port-lookup', 'mime-lookup', 'user-agent'],
  status: 'stable',
};
