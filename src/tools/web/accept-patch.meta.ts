import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'accept-patch',
  name: 'Accept-Patch Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Accept-Patch media-type capabilities.',
  description:
    'Generate or analyze Accept-Patch response values that advertise supported PATCH document formats. Validates media types and parameters, detects duplicates and wildcard scope, and explains that capability does not grant authorization.',
  keywords: [
    'Accept-Patch',
    'PATCH media type',
    'JSON Patch',
    'JSON Merge Patch',
    'HTTP API capability',
    'PATCH formats',
    '415 Unsupported Media Type',
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
        { value: 'analyze', label: 'Analyze media types' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'types',
      label: 'Media types (comma-separated)',
      type: 'text',
      default: 'application/json-patch+json, application/merge-patch+json',
    },
  ],
  examples: [
    {
      title: 'Analyze PATCH capabilities',
      input: 'application/json-patch+json, application/merge-patch+json',
    },
    {
      title: 'Build an API capability header',
      options: { mode: 'build', types: 'application/json-patch+json' },
    },
    {
      title: 'A wildcard capability',
      input: '*/*',
    },
  ],
  related: ['content-type', 'http-status', 'http-header-analyzer'],
  status: 'stable',
};
