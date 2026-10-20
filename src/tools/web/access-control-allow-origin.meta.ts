import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'access-control-allow-origin',
  name: 'Access-Control-Allow-Origin Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect CORS origin grants.',
  description:
    'Generate or analyze the Access-Control-Allow-Origin response header. Validates * or a single origin, flags the conflict with Access-Control-Allow-Credentials: true, and explains the Vary: Origin requirement for dynamic grants.',
  keywords: [
    'Access-Control-Allow-Origin',
    'CORS',
    'cross-origin resource sharing',
    'allow-origin wildcard',
    'allow-credentials',
    'Vary Origin',
    'origin grant',
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
    { key: 'origin', label: 'Allowed origin', type: 'text', default: 'https://app.example.com' },
    {
      key: 'credentials',
      label: 'Allow credentials',
      type: 'select',
      default: 'no',
      choices: [
        { value: 'no', label: 'No' },
        { value: 'yes', label: 'Yes' },
      ],
    },
  ],
  examples: [
    { title: 'Analyze a CORS grant', input: '*' },
    {
      title: 'Build a narrow origin grant',
      options: { mode: 'build', origin: 'https://app.example.com', credentials: 'no' },
    },
  ],
  faq: [
    {
      q: 'What does Access-Control-Allow-Origin do?',
      a: 'It tells the browser which origins may read the cross-origin response, enabling CORS for that caller.',
    },
    {
      q: 'Can * be combined with credentials?',
      a: 'No. When Access-Control-Allow-Credentials: true is set, the Allow-Origin value cannot be a wildcard and must name the specific requesting origin.',
    },
    {
      q: 'Why send Vary: Origin?',
      a: 'When the allowed origin is chosen dynamically per request, Vary: Origin prevents caches from serving the wrong origin grant to other callers.',
    },
  ],
  related: ['http-header-analyzer', 'cross-origin-resource-policy', 'security-headers'],
  hidden: true,
  redirectTo: 'cors-headers',
  status: 'stable',
};
