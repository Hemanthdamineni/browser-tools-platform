import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'access-control-request-headers',
  name: 'CORS Preflight Request Analyzer',
  category: 'web',
  summary: 'Analyze Access-Control-Request-Method and request headers.',
  description:
    'Inspect the browser-sent CORS preflight request headers (Access-Control-Request-Method, Access-Control-Request-Headers, Origin) used before a cross-origin request. Validates the requested method token, splits the requested field-name list, and compares headers against the Allow-* response to anticipate whether the preflight will succeed.',
  keywords: [
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'CORS preflight',
    'OPTIONS request',
    'cross-origin',
    'Access-Control-Allow-Methods',
    'request-header list',
    'field-name',
    'CORS request',
    'preflight check',
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
        { value: 'analyze', label: 'Analyze preflight' },
        { value: 'build', label: 'Build request headers' },
      ],
    },
    {
      key: 'method',
      label: 'Method',
      type: 'select',
      default: 'PATCH',
      choices: [
        { value: 'GET', label: 'GET' },
        { value: 'POST', label: 'POST' },
        { value: 'PUT', label: 'PUT' },
        { value: 'PATCH', label: 'PATCH' },
        { value: 'DELETE', label: 'DELETE' },
        { value: 'OPTIONS', label: 'OPTIONS' },
        { value: 'CONNECT', label: 'CONNECT' },
        { value: 'TRACE', label: 'TRACE' },
      ],
    },
    {
      key: 'headers',
      label: 'Request headers',
      type: 'text',
      default: 'Content-Type, X-Custom-Token',
    },
  ],
  examples: [
    {
      title: 'Analyze a preflight request',
      input:
        'Access-Control-Request-Method: PATCH\nAccess-Control-Request-Headers: Content-Type, X-Custom-Token',
    },
    { title: 'Build a preflight header block', options: { mode: 'build', method: 'PATCH' } },
    {
      title: 'Check a DELETE preflight',
      input:
        'Access-Control-Request-Method: DELETE\nAccess-Control-Request-Headers: Authorization, X-Request-Id\nOrigin: https://app.example.com',
    },
  ],
  related: ['cors-headers', 'http-header-analyzer'],
  status: 'stable',
};
