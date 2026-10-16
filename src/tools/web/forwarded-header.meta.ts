import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'forwarded-header',
  name: 'Forwarded Header Builder & Parser',
  category: 'web',
  summary: 'Build or inspect standardized proxy Forwarded headers.',
  description: 'Generate a Forwarded header element from proxy metadata, or parse comma-separated proxy chains with quoted values, IPv6 hosts, obfuscated identifiers, and malformed-parameter warnings. No network data is accessed.',
  keywords: ['Forwarded header', 'RFC 7239', 'proxy header', 'reverse proxy chain', 'for by proto host', 'obfuscated client IP', 'forwarded parser'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'parse', choices: [{ value: 'parse', label: 'Parse header' }, { value: 'build', label: 'Build element' }] },
    { key: 'forValue', label: 'for value', type: 'text', default: '' },
    { key: 'byValue', label: 'by value (optional)', type: 'text', default: '' },
    { key: 'host', label: 'host (optional)', type: 'text', default: '' },
    { key: 'proto', label: 'proto (optional)', type: 'select', default: '', choices: [{ value: '', label: 'none' }, { value: 'http', label: 'http' }, { value: 'https', label: 'https' }] },
  ],
  examples: [
    { title: 'Parse proxy chain', input: 'for=192.0.2.43;proto=https;host="example.com", for=198.51.100.17' },
    { title: 'Build forwarded element', options: { mode: 'build', forValue: '192.0.2.43', byValue: '203.0.113.10', host: 'example.com', proto: 'https' } },
  ],
  faq: [
    { q: 'Can Forwarded be trusted for authentication?', a: 'Only when a trusted proxy controls and sanitizes it. Clients can send arbitrary header values directly unless the deployment strips and rewrites them.' },
    { q: 'How are IPv6 addresses represented?', a: 'IPv6 addresses in a host value are commonly enclosed in square brackets, such as [2001:db8::1].' },
    { q: 'What does an underscore value mean?', a: 'An obfuscated identifier can protect topology or client details. It is not an IP address and should not be parsed as one.' },
  ],
  related: ['user-agent', 'security-headers', 'http-status'],
  status: 'stable',
};
