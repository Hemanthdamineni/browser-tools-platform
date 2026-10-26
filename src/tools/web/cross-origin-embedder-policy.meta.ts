import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'cross-origin-embedder-policy',
  name: 'Cross-Origin-Embedder-Policy Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect cross-origin resource embedding controls.',
  description:
    'Generate or analyze Cross-Origin-Embedder-Policy values. Validates unsafe-none, require-corp, credentialless, and credentialless=* forms, explains COEP interactions with CORP and CORS, and highlights cross-origin-isolation compatibility locally.',
  keywords: [
    'Cross-Origin-Embedder-Policy',
    'COEP',
    'require-corp',
    'credentialless',
    'cross-origin isolation',
    'CORP',
    'CORS',
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
      default: 'require-corp',
      choices: [
        { value: 'unsafe-none', label: 'unsafe-none' },
        { value: 'require-corp', label: 'require-corp' },
        { value: 'credentialless', label: 'credentialless' },
        { value: 'credentialless=*', label: 'credentialless=*' },
      ],
    },
  ],
  examples: [
    { title: 'Analyze strict embedding policy', input: 'require-corp' },
    { title: 'Build a credentialless policy', options: { mode: 'build', value: 'credentialless' } },
    { title: 'Analyze a value the header does not allow', input: 'same-origin' },
  ],
  related: ['cross-origin-opener-policy', 'cross-origin-resource-policy', 'permissions-policy'],
  status: 'stable',
};
