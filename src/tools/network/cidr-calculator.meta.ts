import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'cidr-calculator',
  name: 'CIDR Calculator',
  category: 'network',
  summary:
    'Calculate network address, range, broadcast and host count for any IPv4 or IPv6 CIDR block.',
  description:
    'Enter an IP address with a CIDR prefix such as 192.168.1.5/24 or 2001:db8::1/64. The tool computes the network address, first and last addresses, total number of addresses, and — for IPv4 — the netmask, wildcard, broadcast and usable host count. Everything runs locally with arbitrary-precision arithmetic, so even full IPv6 ranges are exact.',
  keywords: [
    'cidr calculator',
    'subnet calculator',
    'ip calculator',
    'ipv4',
    'ipv6',
    'cidr notation',
    'subnet mask',
    'network address',
    'broadcast address',
    'prefix length',
    'wildcard mask',
    'ip range',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  examples: [
    { title: 'IPv4 /24', input: '192.168.1.37/24' },
    { title: 'IPv4 /31 (point-to-point)', input: '10.0.0.1/31' },
    { title: 'IPv6 /64', input: '2001:db8:abcd:12::1/64' },
    { title: 'Single IPv6 address', input: 'fe80::1/128' },
  ],
  faq: [
    {
      q: 'What does the prefix number mean?',
      a: 'It is the number of leading 1-bits in the netmask. A larger prefix means a smaller network: /24 gives 256 addresses, /32 gives exactly one. The bits after the prefix are host bits.',
    },
    {
      q: 'Why does /31 or /32 show a special usable-host count?',
      a: 'In classic subnetting /31 has no usable point-to-point hosts under the RFC 3021 convention; /32 is a single host. This tool shows the raw network and broadcast values plus the conventional usable count so you can see both.',
    },
    {
      q: 'Does it work for IPv6?',
      a: 'Yes. IPv6 uses no broadcast address, so ranges are reported as first and last addresses with the exact total count. An IPv4-embedded IPv6 address such as ::ffff:192.0.2.1 is also accepted.',
    },
  ],
  related: ['number-base', 'hex', 'basic-auth'],
  status: 'stable',
};
