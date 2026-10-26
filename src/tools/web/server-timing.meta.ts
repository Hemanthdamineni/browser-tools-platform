import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'server-timing',
  name: 'Server-Timing Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect Server-Timing performance metrics.',
  description:
    'Generate or analyze Server-Timing response metrics with durations and descriptions for browser performance diagnostics. Validates metric tokens, numeric durations, quoted descriptions, and duplicate names entirely on-device.',
  keywords: [
    'Server-Timing',
    'performance metrics header',
    'HTTP timing header',
    'backend timing',
    'browser performance',
    'metric duration parser',
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
        { value: 'analyze', label: 'Analyze metrics' },
        { value: 'build', label: 'Build metric' },
      ],
    },
    { key: 'name', label: 'Metric name', type: 'text', default: 'db' },
    {
      key: 'duration',
      label: 'Duration milliseconds (optional)',
      type: 'number',
      default: 0,
      min: 0,
    },
    { key: 'description', label: 'Description (optional)', type: 'text', default: '' },
    { key: 'server', label: 'Server identifier (optional)', type: 'text', default: '' },
  ],
  examples: [
    {
      title: 'Analyze timing metrics',
      input: 'cache;desc="Redis lookup";dur=2.4, db;dur=18.7, app;dur=4',
    },
    {
      title: 'Build a database metric',
      options: { mode: 'build', name: 'db', duration: 18.7, description: 'PostgreSQL query' },
    },
  ],
  related: ['http-status', 'cache-headers'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
