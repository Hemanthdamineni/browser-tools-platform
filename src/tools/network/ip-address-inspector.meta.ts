import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'ip-address-inspector',
  name: 'IP Address Inspector',
  category: 'network',
  summary: 'Parse and classify an IPv4 or IPv6 address — scope, port, groups and mapped forms.',
  description:
    'Paste any IP address — IPv4 or IPv6, with or without a port, and including IPv4-mapped forms like ::ffff:1.2.3.4 — and get a breakdown: whether it is private (RFC 1918 / ULA), loopback, link-local, multicast, documentation, reserved or global unicast; the port when present; the octets or 16-bit groups with binary; and the expanded and compressed forms. IPv6 zone identifiers (fe80::1%eth0) are parsed too. Everything runs on-device with no lookups.',
  keywords: [
    'ip inspector',
    'ipv4 analyzer',
    'ipv6 analyzer',
    'private ip',
    'public ip',
    'loopback',
    'link-local',
    'ipv4 mapped ipv6',
    'ipv6 compressed form',
    'ip classification',
    'port lookup',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [{ key: 'showBinary', label: 'Show binary detail', type: 'boolean', default: true }],
  examples: [
    { title: 'Private IPv4', input: '192.168.1.42' },
    { title: 'IPv4 with port', input: '10.0.0.5:8080' },
    { title: 'IPv6 loopback', input: '::1' },
    { title: 'IPv4-mapped IPv6', input: '::ffff:192.168.1.42' },
    { title: 'IPv6 with zone', input: 'fe80::a1b2:c3d4%eth0' },
  ],
  related: ['ipv6-expander', 'cidr-calculator', 'mac-address', 'port-lookup'],
  status: 'stable',
};
