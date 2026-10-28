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
  ],
  faq: [
    {
      q: 'What does expansion do?',
      a: 'It inserts the missing hextets of 0000 until the address has the full 8 hextets, each with 4 hex digits.',
    },
    {
      q: 'Is :: valid?',
      a: 'Yes — :: may appear at most once, representing the run of zero hextets. At least twice is invalid.',
    },
    {
      q: 'Can expansion reduce it again?',
      a: 'Often yes; the compress mode re-applies the rules to shorten the form, though it may choose different zero suppression than a canonical compressor.',
    },
  ],
  related: [  "cidr-calculator",
  "punycode"],
  status: 'stable',
};
