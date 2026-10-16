import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'accept-post',
  name: 'Accept-Post Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Accept-Post media-type capabilities.',
  description: 'Generate or analyze Accept-Post response values that advertise supported POST document formats. Validates media types and parameters, detects duplicates and wildcard scope, and explains that capability does not grant authorization.',
  keywords: ['Accept-Post', 'POST media type', 'HTTP API capability', 'document formats', '415 Unsupported Media Type', 'media type analyzer'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze media types' }, { value: 'build', label: 'Build header' }] },
    { key: 'types', label: 'Media types (comma-separated)', type: 'text', default: 'application/json, application/x-www-form-urlencoded' },
  ],
  examples: [
    { title: 'Analyze POST capabilities', input: 'application/json, application/x-www-form-urlencoded' },
    { title: 'Build a capability header', options: { mode: 'build', types: 'application/json' } },
  ],
  faq: [
    { q: 'Does Accept-Post authorize a client?', a: 'No. It advertises supported document formats; authentication and authorization still determine whether a POST is allowed.' },
    { q: 'Where is Accept-Post useful?', a: 'It can describe formats accepted by a resource, commonly in OPTIONS responses or API capability discovery.' },
    { q: 'What happens for an unsupported format?', a: 'A server may reject the request with 415 Unsupported Media Type.' },
  ],
  related: ['content-type', 'accept-patch', 'http-status'],
  status: 'stable',
};
