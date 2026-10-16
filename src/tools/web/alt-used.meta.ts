import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'alt-used',
  name: 'Alt-Used Header Analyzer',
  category: 'web',
  summary: 'Validate the Alt-Used request header back to the origin.',
  description: 'Analyze the Alt-Used request header, which clients send to the origin server to indicate the alternative service (host:port) actually used, as defined by RFC 7838. Complements the Alt-Svc response header tool.',
  keywords: ['Alt-Used', 'Alt-Used request header', 'RFC 7838', 'alternative service', 'ALPN', 'alt-svc', 'origin server', 'client signaling', 'host', 'port'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze value' }, { value: 'build', label: 'Build header' }] },
    { key: 'value', label: 'Host:port used', type: 'text', default: 'h2.example.com:443' },
  ],
  examples: [
    { title: 'Analyze a used alt service', input: 'h2.example.com:443' },
    { title: 'Build the request header', options: { mode: 'build', value: 'h2.example.com:443' } },
  ],
  faq: [
    { q: 'What is Alt-Used?', a: 'A request header that tells the origin server which alternative service the client used, matching the Alt-Svc offered for that origin.' },
    { q: 'When is it sent?', a: 'A client sends Alt-Used when it successfully connects to an alternative per the Alt-Svc of that origin, after ALPN offers HTTP/2 or HTTP/3.' },
    { q: 'How does it compare to Alt-Svc?', a: 'Alt-Svc is sent by the server advertising alternatives; Alt-Used is sent by the client confirming which alternative it actually used.' },
  ],
  related: ['alt-svc', 'origin-header', 'via-header'],
  status: 'stable',
};
