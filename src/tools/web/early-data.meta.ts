import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'early-data',
  name: 'Early-Data Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Early-Data replay signals.',
  description:
    'Generate or analyze the Early-Data request header used with TLS 1.3 0-RTT. Validates the standardized 0 signal, explains 425 Too Early handling, and highlights replay and idempotency risks locally.',
  keywords: [
    'Early-Data',
    'TLS 1.3 0-RTT',
    '425 Too Early',
    'replay attack',
    'HTTP early data',
    'idempotent request',
    'anti-replay',
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
        { value: 'analyze', label: 'Analyze signal' },
        { value: 'build', label: 'Build header' },
      ],
    },
    { key: 'value', label: 'Early-Data value', type: 'text', default: '0' },
  ],
  examples: [
    { title: 'Analyze a 0-RTT request signal', input: '0' },
    { title: 'Build an Early-Data header', options: { mode: 'build', value: '0' } },
  ],
  related: ['http-status', 'http-header-analyzer', 'security-headers'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
