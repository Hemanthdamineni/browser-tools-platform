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
  ],
  faq: [
    {
      q: 'What does Proxy-Status describe?',
      a: 'A proxy can use it to report how it processed a request and why it could not complete it, often alongside a 502 or 504 response.',
    },
    {
      q: 'Can it expose infrastructure details?',
      a: 'Yes. Proxy identifiers and parameters can reveal topology or vendor details, so emit only information appropriate for clients.',
    },
    {
      q: 'Does this diagnose a live request?',
      a: 'No. This tool parses and builds header values locally without making network requests.',
    },
  ],
  related: [  "http-header-analyzer",
  "http-status"],
  status: 'stable',
};
