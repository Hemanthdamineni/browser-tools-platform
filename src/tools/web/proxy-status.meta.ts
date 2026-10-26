import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'proxy-status',
  name: 'Proxy-Status Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Proxy-Status diagnostics.',
  description:
    'Generate or analyze Proxy-Status response entries that describe proxy processing and failures. Validates proxy identifiers, parameters, quoted values, and common error tokens while highlighting topology-disclosure risks.',
  keywords: [
    'Proxy-Status',
    'HTTP proxy diagnostics',
    'proxy error',
    'proxy-status error',
    'proxy observability',
    'bad gateway',
    'gateway timeout',
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
        { value: 'analyze', label: 'Analyze entries' },
        { value: 'build', label: 'Build entry' },
      ],
    },
    { key: 'proxy', label: 'Proxy identifier', type: 'text', default: 'edge' },
    { key: 'error', label: 'Error token (optional)', type: 'text', default: 'connection_refused' },
    { key: 'next', label: 'Next proxy (optional)', type: 'text', default: '' },
  ],
  examples: [
    {
      title: 'Analyze proxy diagnostics',
      input: 'edge; error=connection_refused; next="upstream"',
    },
    {
      title: 'Build a proxy error entry',
      options: { mode: 'build', proxy: 'edge', error: 'connection_refused' },
    },
    {
      title: 'Build an entry with a next hop',
      options: { mode: 'build', proxy: 'cdn-cache', error: '', next: 'origin-server' },
    },
  ],
  related: ['http-header-analyzer', 'http-status'],
  status: 'stable',
};
