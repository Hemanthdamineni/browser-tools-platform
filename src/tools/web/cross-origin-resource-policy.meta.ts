import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'cross-origin-resource-policy',
  name: 'Cross-Origin-Resource-Policy Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect CORP resource-embedding policies.',
  description:
    'Generate or analyze Cross-Origin-Resource-Policy response values. Validates same-origin, same-site, and cross-origin policies, explains resource embedding and cross-origin isolation tradeoffs, and warns when broad exposure is intentional.',
  keywords: [
    'Cross-Origin-Resource-Policy',
    'CORP',
    'same-origin',
    'same-site',
    'cross-origin isolation',
    'resource embedding',
    'COEP',
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
        { value: 'analyze', label: 'Analyze policy' },
        { value: 'build', label: 'Build policy' },
      ],
    },
    {
      key: 'value',
      label: 'Policy',
      type: 'select',
      default: 'same-origin',
      choices: [
        { value: 'same-origin', label: 'same-origin' },
        { value: 'same-site', label: 'same-site' },
        { value: 'cross-origin', label: 'cross-origin' },
      ],
    },
  ],
  examples: [
    { title: 'Analyze a strict resource policy', input: 'same-origin' },
    { title: 'Build a same-site policy', options: { mode: 'build', value: 'same-site' } },
  ],
  faq: [
    {
      q: 'What does CORP protect?',
      a: 'It lets a resource declare which origins may load it in cross-origin contexts, reducing unwanted reads or embeddings in supported browsers.',
    },
    {
      q: 'Which value is strictest?',
      a: 'same-origin is strictest, same-site permits related sites, and cross-origin permits broad embedding.',
    },
    {
      q: 'Does CORP replace CORS?',
      a: 'No. CORP controls loading/embedding policy, while CORS controls whether scripts may read cross-origin responses.',
    },
  ],
  related: ['security-headers', 'origin-agent-cluster', 'content-security-policy'],
  status: 'stable',
};
