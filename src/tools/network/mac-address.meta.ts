import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'mac-address',
  name: 'MAC Address Analyzer',
  category: 'network',
  summary: 'Validate, normalize and decode MAC addresses, incl. EUI-64.',
  description:
    'Parse a 48-bit MAC/EUI-48 address in any common notation (colon, dash, Cisco dot, or contiguous hex), validate its structure, decode the unicast/multicast and locally-administered bits, normalize it, and convert it to the EUI-64 interface identifier used for IPv6 SLAAC. A compact OUI vendor map guesses the manufacturer for common prefixes.',
  keywords: [
    'MAC address',
    'MAC address analyzer',
    'EUI-48',
    'EUI-64',
    'IPv6 SLAAC',
    'OUI',
    'vendor lookup',
    'mac format',
    'multicast mac',
    'locally administered',
    'interface identifier',
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
        { value: 'analyze', label: 'Analyze and normalize' },
        { value: 'eui64', label: 'Convert to EUI-64' },
      ],
    },
  ],
  examples: [
    { title: 'Analyze a MAC', input: '3C:22:FB:9C:11:D4' },
    { title: 'Convert to EUI-64', input: '3c:22:fb:9c:11:d4', options: { mode: 'eui64' } },
    { title: 'Analyze a Cisco dotted address', input: '001b.213c.22fb' },
  ],
  related: ['ipv6-expander', 'cidr-calculator', 'url-parse'],
  status: 'stable',
};
