import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'origin-agent-cluster',
  name: 'Origin-Agent-Cluster Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect origin-keyed browsing isolation signals.',
  description: 'Generate or analyze the Origin-Agent-Cluster response header. Validates the structured boolean ?1 or ?0 value, explains origin-keyed agent-cluster isolation and opt-out behavior, and notes that browser support and response consistency matter.',
  keywords: ['Origin-Agent-Cluster', 'origin isolation', 'agent cluster', 'cross-origin isolation', 'browser process isolation', 'structured boolean', 'privacy header'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze value' }, { value: 'build', label: 'Build header' }] },
    { key: 'value', label: 'Value', type: 'text', default: '?1' },
  ],
  examples: [
    { title: 'Analyze an isolation signal', input: '?1' },
    { title: 'Build an origin-keyed header', options: { mode: 'build', value: '?1' } },
  ],
  faq: [
    { q: 'What does Origin-Agent-Cluster: ?1 request?', a: 'It requests that the document use an origin-keyed agent cluster rather than a site-keyed one, reducing some cross-origin shared-memory exposure.' },
    { q: 'Does ?1 guarantee process isolation?', a: 'No. It is an agent-cluster isolation request, not a universal browser process or cross-origin isolation guarantee.' },
    { q: 'Can it be changed later?', a: 'Changing the value across responses can create compatibility issues; deploy consistently and test pages that use document.domain or related legacy behavior.' },
  ],
  related: ['permissions-policy', 'security-headers', 'content-security-policy'],
  status: 'stable',
};
