import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'critical-ch',
  name: 'Critical-CH Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP critical client-hints values.',
  description:
    'Generate or analyze Critical-CH response values that identify client hints required for correct rendering. Validates hint tokens, detects duplicates and high-entropy privacy-sensitive hints, and explains retry and cache behavior locally.',
  keywords: [
    'Critical-CH',
    'Client Hints',
    'critical client hints',
    'HTTP retry',
    'Sec-CH-UA',
    'Viewport-Width',
    'browser hints',
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
        { value: 'analyze', label: 'Analyze hints' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'hints',
      label: 'Critical hints (space-separated)',
      type: 'text',
      default: 'Viewport-Width, DPR',
    },
  ],
  examples: [
    { title: 'Analyze critical hints', input: 'Viewport-Width, DPR' },
    {
      title: 'Build a critical-hints header',
      options: { mode: 'build', hints: 'Viewport-Width DPR' },
    },
  ],
  related: ['http-header-analyzer', 'cache-headers', 'permissions-policy'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
