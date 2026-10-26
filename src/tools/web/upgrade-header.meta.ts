import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'upgrade-header',
  name: 'Upgrade Header Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Upgrade protocol-switch values.',
  description:
    'Generate or analyze Upgrade header protocol tokens for HTTP/1.1 protocol switching and WebSocket handshakes. Validates protocol names and versions, detects duplicates, and warns about HTTP/2 and HTTP/3 limitations locally.',
  keywords: [
    'Upgrade header',
    'WebSocket upgrade',
    'HTTP protocol switch',
    'HTTP/1.1 upgrade',
    'protocol version header',
    '101 Switching Protocols',
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
        { value: 'analyze', label: 'Analyze protocols' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'protocols',
      label: 'Protocols (comma-separated)',
      type: 'text',
      default: 'websocket, HTTP/2.0',
    },
  ],
  examples: [
    { title: 'Analyze a WebSocket request', input: 'websocket' },
    { title: 'Build a protocol declaration', options: { mode: 'build', protocols: 'websocket' } },
  ],
  related: ['http-status', 'http-header-analyzer', 'content-type'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
