import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'access-control-allow-methods-headers',
  name: 'Access-Control-Allow-Methods & Headers Builder',
  category: 'web',
  summary: 'Build or inspect CORS preflight grant lists.',
  description:
    'Generate or analyze the Access-Control-Allow-Methods and Access-Control-Allow-Headers response values used in CORS preflight. Validates method and header-name tokens, detects duplicates, and explains wildcard and credentials restrictions.',
  keywords: [
    'Access-Control-Allow-Methods',
    'Access-Control-Allow-Headers',
    'CORS preflight',
    'OPTIONS request',
    'allowed methods',
    'allowed headers',
    'wildcard',
    'content-type header',
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
        { value: 'analyze', label: 'Analyze lists' },
        { value: 'build', label: 'Build lists' },
      ],
    },
    { key: 'methods', label: 'Allowed methods', type: 'text', default: 'GET, POST, PUT, DELETE' },
    {
      key: 'headers',
      label: 'Allowed headers',
      type: 'text',
      default: 'Content-Type, Authorization',
    },
  ],
  examples: [
    {
      title: 'Analyze preflight grants',
      input:
        'Access-Control-Allow-Methods: GET, POST\nAccess-Control-Allow-Headers: Content-Type, Authorization',
    },
    {
      title: 'Build a grant set',
      options: { mode: 'build', methods: 'GET, POST', headers: 'Content-Type' },
    },
  ],
  faq: [
    {
      q: 'When are these headers used?',
      a: 'The browser sends a CORS preflight (OPTIONS) request before non-simple requests; these headers tell it which methods and headers the server accepts.',
    },
    {
      q: 'What is a wildcard grant?',
      a: 'A * value answers that any of the simple methods or safe headers are allowed, but it cannot be combined with credentials in some cases.',
    },
    {
      q: 'What counts as a simple method?',
      a: 'GET, HEAD, and POST are simple; most others (PUT, DELETE, PATCH) trigger a preflight.',
    },
  ],
  related: [  "cors-headers",
  "security-headers",
  "http-status"],
  hidden: true,
  redirectTo: 'cors-headers',
  status: 'stable',
};
