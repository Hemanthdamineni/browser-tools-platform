import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'connection-header',
  name: 'Connection Header Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP/1.1 Connection control tokens.',
  description:
    'Generate or analyze Connection header tokens for HTTP/1.1 hop-by-hop behavior, including Upgrade workflows. Validates field-name tokens, detects duplicates and unsafe forwarding declarations, and warns that HTTP/2 and HTTP/3 prohibit this header.',
  keywords: [
    'Connection header',
    'HTTP hop-by-hop',
    'Connection Upgrade',
    'keep-alive',
    'HTTP/1.1 controls',
    'HTTP/2 forbidden header',
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
        { value: 'analyze', label: 'Analyze tokens' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'tokens',
      label: 'Connection tokens (comma-separated)',
      type: 'text',
      default: 'keep-alive, Upgrade',
    },
  ],
  examples: [
    { title: 'Analyze WebSocket handshake controls', input: 'keep-alive, Upgrade' },
    { title: 'Build an Upgrade connection value', options: { mode: 'build', tokens: 'Upgrade' } },
  ],
  faq: [
    {
      q: 'What does hop-by-hop mean?',
      a: 'A hop-by-hop field applies only to the current connection and must not be blindly forwarded by proxies.',
    },
    {
      q: 'Can HTTP/2 or HTTP/3 send Connection?',
      a: 'No. Connection is prohibited in HTTP/2 and HTTP/3; use protocol-specific mechanisms instead.',
    },
    {
      q: 'Is Upgrade enough for WebSockets?',
      a: 'No. HTTP/1.1 WebSocket handshakes use Connection: Upgrade together with Upgrade: websocket and other handshake fields.',
    },
  ],
  related: ['http-header-analyzer', 'security-headers'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
