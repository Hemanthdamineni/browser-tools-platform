import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'ipv4-to-int',
  name: 'IPv4 ↔ Integer',
  category: 'network',
  summary: 'Convert between a dotted IPv4 address and its 32-bit integer form, either direction.',
  description:
    'Translate a dotted-quad IPv4 address (192.168.1.1) into its unsigned 32-bit integer (3232235777) and back again. Handy for config, logging and range math without a CIDR block. Paste either form — the tool detects which one you gave and converts to the other, showing both for reference. Works entirely on your device.',
  keywords: [
    'ipv4 to int',
    'ip to integer',
    'int to ipv4',
    'dotted quad to number',
    'ip address to number',
    'convert ip to long',
    '32-bit ip conversion',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'showBoth',
      label: 'Show both forms',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'IP to integer',
      input: '192.168.1.1',
    },
    {
      title: 'Integer to IP',
      input: '3232235777',
    },
    {
      title: 'Integer to IP, bare result',
      input: '167772161',
      options: { showBoth: false },
    },
  ],
  related: ['cidr-calculator', 'ip-address-inspector', 'number-base', 'ipv6-expander'],
  status: 'stable',
};
