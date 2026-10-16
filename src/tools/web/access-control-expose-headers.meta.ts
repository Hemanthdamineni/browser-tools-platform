import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'access-control-expose-headers',
  name: 'Access-Control-Expose-Headers Builder',
  category: 'web',
  summary: 'Build or inspect exposed cross-origin response headers.',
  description: 'Generate or analyze the Access-Control-Expose-Headers response value. Validates header-name tokens, flags the wildcard-with-credentials restriction, and explains which response headers scripts may read cross-origin.',
  keywords: ['Access-Control-Expose-Headers', 'CORS expose headers', 'exposed headers', 'response headers readable', 'header whitelist', 'cross-origin reading'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze value' }, { value: 'build', label: 'Build value' }] },
    { key: 'headers', label: 'Header names (comma-separated)', type: 'text', default: 'X-Request-Id, X-Rate-Limit' },
  ],
  examples: [
    { title: 'Analyze exposed headers', input: 'X-Request-Id, X-Rate-Limit' },
    { title: 'Build a single exposed header', options: { mode: 'build', headers: 'X-Total-Count' } },
  ],
  faq: [
    { q: 'What does Access-Control-Expose-Headers do?', a: 'It whitelists response headers that cross-origin scripts are allowed to read. By default only a small set of safe headers is exposed.' },
    { q: 'Does the wildcard work with credentials?', a: 'No. When Access-Control-Allow-Credentials: true is set, the value cannot be a wildcard and must name specific headers.' },
    { q: 'How do I read custom headers cross-origin?', a: 'Add each custom header name here so the browser lets scripts access it from a cross-origin fetch.' },
  ],
  related: ['access-control-allow-origin', 'access-control-allow-methods-headers', 'security-headers'],
  hidden: true,
  redirectTo: 'cors-headers',
  status: 'stable',
};
