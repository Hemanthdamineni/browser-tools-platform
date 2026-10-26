import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'cross-origin-opener-policy',
  name: 'Cross-Origin-Opener-Policy Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect browsing-context opener isolation.',
  description:
    'Generate or analyze Cross-Origin-Opener-Policy values. Validates same-origin, same-origin-allow-popups, unsafe-none, and restrict-properties, explains popup/opener isolation, and highlights compatibility tradeoffs locally.',
  keywords: [
    'Cross-Origin-Opener-Policy',
    'COOP',
    'browsing context group',
    'window.opener',
    'popup isolation',
    'cross-origin isolation',
    'same-origin-allow-popups',
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
        { value: 'same-origin-allow-popups', label: 'same-origin-allow-popups' },
        { value: 'unsafe-none', label: 'unsafe-none' },
        { value: 'restrict-properties', label: 'restrict-properties' },
      ],
    },
  ],
  examples: [
    { title: 'Analyze strict opener isolation', input: 'same-origin' },
    {
      title: 'Build a popup-compatible policy',
      options: { mode: 'build', value: 'same-origin-allow-popups' },
    },
    { title: 'Assess the no-isolation default', input: 'unsafe-none' },
  ],
  related: ['cross-origin-resource-policy', 'origin-agent-cluster', 'security-headers'],
  status: 'stable',
};
