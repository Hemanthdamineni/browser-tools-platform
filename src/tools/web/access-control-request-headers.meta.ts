import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'access-control-request-headers',
  name: 'CORS Preflight Request Analyzer',
  category: 'web',
  summary: 'Analyze Access-Control-Request-Method and request headers.',
  description: 'Inspect the browser-sent CORS preflight request headers (Access-Control-Request-Method, Access-Control-Request-Headers, Origin) used before a cross-origin request. Validates the requested method token, splits the requested field-name list, and compares headers against the Allow-* response to anticipate whether the preflight will succeed.',
  keywords: ['Access-Control-Request-Method', 'Access-Control-Request-Headers', 'CORS preflight', 'OPTIONS request', 'cross-origin', 'Access-Control-Allow-Methods', 'request-header list', 'field-name', 'CORS request', 'preflight check'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze preflight' }, { value: 'build', label: 'Build request headers' }] },
    { key: 'method', label: 'Method', type: 'select', default: 'PATCH', choices: [{ value: 'GET', label: 'GET' }, { value: 'POST', label: 'POST' }, { value: 'PUT', label: 'PUT' }, { value: 'PATCH', label: 'PATCH' }, { value: 'DELETE', label: 'DELETE' }, { value: 'OPTIONS', label: 'OPTIONS' }, { value: 'CONNECT', label: 'CONNECT' }, { value: 'TRACE', label: 'TRACE' }] },
    { key: 'headers', label: 'Request headers', type: 'text', default: 'Content-Type, X-Custom-Token' },
  ],
  examples: [
    { title: 'Analyze a preflight request', input: 'Access-Control-Request-Method: PATCH\nAccess-Control-Request-Headers: Content-Type, X-Custom-Token' },
    { title: 'Build a preflight header block', options: { mode: 'build', method: 'PATCH' } },
  ],
  faq: [
    { q: 'When is a preflight sent?', a: 'For requests that are not simple — non-safelisted methods (PUT, PATCH, DELETE) or non-safelisted headers — the browser sends an OPTIONS preflight first, and proceeds only if the response allows it.' },
    { q: 'What do the two headers mean?', a: 'Access-Control-Request-Method states the method the real request will use; Access-Control-Request-Headers lists the custom headers it will send.' },
    { q: 'How do I read this vs Allow-* ?', a: 'The server must echo back Access-Control-Allow-Methods/Headers covering those requested values; otherwise the browser blocks the real request.' },
  ],
  related: ['cors-headers', 'origin-header'],
  status: 'stable',
};
