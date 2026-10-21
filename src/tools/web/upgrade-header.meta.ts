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
  faq: [
    {
      q: 'Does Upgrade alone switch protocols?',
      a: 'No. HTTP/1.1 also requires Connection: Upgrade, and the server must accept the switch with the appropriate response such as 101 Switching Protocols.',
    },
    {
      q: 'Can HTTP/2 use Upgrade?',
      a: 'Extended CONNECT is used for many HTTP/2 protocol tunnels; the HTTP/1.1 Upgrade mechanism is not generally available. HTTP/3 has similar constraints.',
    },
    {
      q: 'Does this test a WebSocket server?',
      a: 'No. It validates the header value locally and never opens a network connection.',
    },
  ],
  related: ['http-status', 'http-header-analyzer', 'content-type'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
