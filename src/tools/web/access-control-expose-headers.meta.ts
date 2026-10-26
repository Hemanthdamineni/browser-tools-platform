import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'access-control-expose-headers',
  name: 'Access-Control-Expose-Headers Builder',
  category: 'web',
  summary: 'Build or inspect exposed cross-origin response headers.',
  description:
    'Generate or analyze the Access-Control-Expose-Headers response value. Validates header-name tokens, flags the wildcard-with-credentials restriction, and explains which response headers scripts may read cross-origin.',
  keywords: [
    'Access-Control-Expose-Headers',
    'CORS expose headers',
    'exposed headers',
    'response headers readable',
    'header whitelist',
    'cross-origin reading',
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
        { value: 'build', label: 'Build value' },
      ],
    },
    {
      key: 'headers',
      label: 'Header names (comma-separated)',
      type: 'text',
      default: 'X-Request-Id, X-Rate-Limit',
    },
  ],
  examples: [
    { title: 'Analyze exposed headers', input: 'X-Request-Id, X-Rate-Limit' },
    {
      title: 'Build a single exposed header',
      options: { mode: 'build', headers: 'X-Total-Count' },
    },
  ],
  related: ['cors-headers', 'security-headers'],
  hidden: true,
  redirectTo: 'cors-headers',
  status: 'stable',
};
