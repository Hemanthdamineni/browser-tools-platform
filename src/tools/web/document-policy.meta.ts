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
      options: { mode: 'build', directives: 'unload=(), max-age=10' },
    },
  ],
  faq: [
    {
      q: 'What does Document-Policy control?',
      a: 'It lets a document opt into or restrict browser behaviors and performance-related features, depending on browser support and the directive.',
    },
    {
      q: 'Is it the same as Permissions-Policy?',
      a: 'No. Permissions-Policy governs powerful feature access and delegation; Document-Policy governs document behavior and performance controls.',
    },
    {
      q: 'Should I deploy it immediately?',
      a: 'Roll out carefully, validate browser support, and test affected code because enforcing a policy can change page behavior.',
    },
  ],
  related: [  "permissions-policy",
  "security-headers",
  "cross-origin-opener-policy"],
  status: 'stable',
};
