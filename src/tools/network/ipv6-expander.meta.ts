import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'ipv6-expander',
  name: 'IPv6 Address Expander',
  category: 'network',
  summary: 'Expand and validate IPv6 addresses (:: shorthand).',
  description:
    'Expand an IPv6 address with :: shorthand into its full 8-hextet, zero-padded 32-character form, and produce a fully expanded unsolicited check of the address grammar. Validate with the IPv6 spec rules, including handling embedded IPv4-mapped addresses and zone identifiers.',
  keywords: [
    'IPv6',
    'expand',
    'address validation',
    ':: shorthand',
    'IPv6 grammar',
    'full hexadecimal form',
    'compress IPv6',
    'IPv6 zone scope',
    'IPv6-mapped IPv4',
    'network address',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'expand',
      choices: [
        { value: 'expand', label: 'Expand address' },
        { value: 'compress', label: 'Strip leading zeros' },
        { value: 'validate', label: 'Validate address grammar' },
      ],
    },
    {
      key: 'lowercase',
      label: 'Lowercase output',
      type: 'select',
      default: 'keep',
      choices: [
        { value: 'keep', label: 'Keep input case' },
        { value: 'lower', label: 'Lowercase' },
      ],
    },
  ],
  examples: [
    { title: 'Expand an abbreviated address', input: '2001:db8::1' },
    { title: 'Validate an IPv6 address', options: { mode: 'validate', lowercase: 'keep' } },
    {
      title: 'Compress back to shorthand',
      input: '2001:0db8:0000:0000:0000:0000:0000:0001',
      options: { mode: 'compress' },
    },
  ],
  related: ['cidr-calculator', 'punycode'],
  status: 'stable',
};
