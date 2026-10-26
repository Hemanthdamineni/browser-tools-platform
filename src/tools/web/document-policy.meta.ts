import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'document-policy',
  name: 'Document-Policy Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect Document-Policy behavior controls.',
  description:
    'Generate or analyze Document-Policy directives for controlling document behaviors such as unload handlers, sync XHR, and layout performance features. Validates tokens, numeric thresholds, duplicate directives, and explains rollout and browser-support caveats locally.',
  keywords: [
    'Document-Policy',
    'document policy',
    'unload',
    'sync-xhr',
    'layout-instability',
    'performance policy',
    'browser policy',
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
        { value: 'analyze', label: 'Analyze directives' },
        { value: 'build', label: 'Build header' },
      ],
    },
    { key: 'directives', label: 'Directives', type: 'text', default: 'unload=()' },
  ],
  examples: [
    { title: 'Analyze document controls', input: 'unload=(), sync-xhr=()' },
    {
      title: 'Build a policy header',
      options: { mode: 'build', directives: 'unload=(), max-age=(10)' },
    },
    {
      title: 'Check a high threshold directive',
      input: 'unload=(), sync-xhr=(), layout-animations=()',
    },
  ],
  related: ['permissions-policy', 'security-headers', 'cross-origin-opener-policy'],
  status: 'stable',
};
