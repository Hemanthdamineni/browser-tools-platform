import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'origin-agent-cluster',
  name: 'Origin-Agent-Cluster Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect origin-keyed browsing isolation signals.',
  description:
    'Generate or analyze the Origin-Agent-Cluster response header. Validates the structured boolean ?1 or ?0 value, explains origin-keyed agent-cluster isolation and opt-out behavior, and notes that browser support and response consistency matter.',
  keywords: [
    'Origin-Agent-Cluster',
    'origin isolation',
    'agent cluster',
    'cross-origin isolation',
    'browser process isolation',
    'structured boolean',
    'privacy header',
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
    { key: 'value', label: 'Value', type: 'text', default: '?1' },
  ],
  examples: [
    { title: 'Analyze an isolation signal', input: '?1' },
    { title: 'Build an origin-keyed header', options: { mode: 'build', value: '?1' } },
    { title: 'Analyze an explicit opt-out', input: '?0' },
  ],
  related: ['permissions-policy', 'security-headers', 'content-security-policy'],
  status: 'stable',
};
