import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'age-header',
  name: 'Age Response Header Analyzer',
  category: 'web',
  summary: 'Validate Age response header cache residency.',
  description:
    'Analyze the Age response header defined in RFC 9111, which reports how long (in seconds) a cached object has already been in the cache. Validates the non-negative integer delta-seconds, checks plausibility against the current time, and explains its role in freshness checking.',
  keywords: [
    'Age header',
    'RFC 9111',
    'cache residency',
    'delta-seconds',
    'shared cache',
    'response age',
    'age value',
    'cached seconds',
    'freshness',
    'HTTP cache age',
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
        { value: 'analyze', label: 'Analyze value' },
        { value: 'build', label: 'Build header' },
      ],
    },
    { key: 'seconds', label: 'Seconds', type: 'text', default: '120' },
  ],
  examples: [
    { title: 'Analyze a cache age', input: '120' },
    { title: 'Build a response age', options: { mode: 'build', seconds: '3600' } },
  ],
  related: ['cache-headers', 'http-header-analyzer'],
  hidden: true,
  redirectTo: 'cache-headers',
  status: 'stable',
};
