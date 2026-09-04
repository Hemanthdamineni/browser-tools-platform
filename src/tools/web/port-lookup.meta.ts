import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'port-lookup',
  name: 'Network Port Lookup',
  category: 'web',
  summary: 'Look up which service uses a TCP/UDP port, or find ports by service name.',
  description:
    'Enter a port number (22), a service name (ssh, redis) or leave empty to browse a table of well-known and registered ports with protocol, service and description. About 160 entries covering web, mail, databases, dev servers and infrastructure.',
  keywords: [
    'port lookup',
    'port number',
    'tcp udp ports',
    'well known ports',
    'port 443',
    'port 22',
    'service port',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  examples: [
    { title: 'SSH port', input: '22' },
    { title: 'By name', input: 'redis' },
    { title: 'Browse all', input: '' },
  ],
  faq: [
    {
      q: 'Why do two services sometimes share a port?',
      a: 'TCP and UDP are separate namespaces, and some historical services registered both. The Protocol column shows whether an entry applies to TCP, UDP, or both.',
    },
  ],
  related: ['ip-info', 'http-status', 'cidr-calculator'],
  status: 'stable',
};
