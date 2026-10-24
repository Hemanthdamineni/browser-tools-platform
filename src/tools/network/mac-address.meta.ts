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
  article: [
    {
      heading: 'Every notation, one decoded table',
      body: 'Paste a 48-bit address as 3C:22:FB:9C:11:D4, 00-1B-21-3C-22-FB, 001b.213c.22fb or twelve bare hex digits. The analyzer reports the normalized colon form, the notation it detected, the OUI, the multicast and local bits, and the EUI-64, all in one table.',
    },
    {
      heading: 'What the first octet tells you',
      body: 'The lowest bit of the first octet flags a multicast address, a group destination rather than a single device. The next bit flags an address set locally instead of by the manufacturer, which means the vendor prefix carries no weight there and should not be trusted.',
    },
    {
      heading: 'Building the IPv6 interface identifier',
      body: 'Switch the mode to Convert to EUI-64 to get the 64-bit identifier SLAAC uses: the U/L bit is inverted and FF:FE is inserted after the third octet, so 3C:22:FB:9C:11:D4 becomes 3E:22:FB:FF:FE:9C:11:D4. Attach it to a /64 prefix to form the full address.',
    },
    {
      heading: 'The vendor name is only a guess',
      body: 'Manufacturers come from a small built-in OUI map covering common prefixes from Apple, Cisco, Intel, Raspberry Pi and others. A prefix that is not in that map simply reads Unknown, and a match is never proof of ownership: addresses get reassigned, virtualized and spoofed.',
    },
    {
      heading: 'Parsed entirely on this device',
      body: 'The bit tests, normalization and OUI lookup are plain JavaScript in this tab. No address is transmitted, no vendor database is queried over the network, and the page works offline.',
    },
  ],
  examples: [
    { title: 'Analyze a MAC', input: '3C:22:FB:9C:11:D4' },
    { title: 'Convert to EUI-64', input: '3c:22:fb:9c:11:d4', options: { mode: 'eui64' } },
    { title: 'Analyze a Cisco dotted address', input: '001b.213c.22fb' },
  ],
  faq: [
    {
      q: 'What is EUI-64?',
      a: 'A 64-bit interface identifier derived from the MAC by inverting the U/L bit and inserting FF:FE after the first three octets — the basis of SLAAC IPv6 addresses.',
    },
    {
      q: 'Is a MAC unique by itself?',
      a: 'The OUI is assigned to a company, but the NIC/ULA bits and later octets must be unique on a LAN; locally-administered addresses can be set by anyone.',
    },
    {
      q: 'What notations are accepted?',
      a: 'AA:BB:CC:DD:EE:FF, AA-BB-CC-DD-EE-FF, aabb.ccdd.eeff, or 12 contiguous hex digits.',
    },
  ],
  related: ['ipv6-expander', 'cidr-calculator', 'url-parse'],
  status: 'stable',
};
