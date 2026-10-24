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
  article: [
    {
      heading: 'Expanding, compressing and validating',
      body: 'Give it an IPv6 address and it either writes out all eight hextets zero-padded to four digits (2001:0db8:0000:0000:0000:0000:0000:0001), strips the leading zeros and re-applies the :: shorthand (2001:db8::1), or simply checks the grammar and reports Valid or Invalid with a reason. Several addresses separated by spaces or commas are validated together as a table.',
    },
    {
      heading: 'When a full address is what you need',
      body: 'Expanded form is what network gear, log parsers, ACLs and regular expressions often demand, and it is the shape that makes two addresses comparable by eye. Use it to confirm that two differently-written addresses are really the same host, to prepare an address for a firewall rule, or to check one before it lands in a config file.',
    },
    {
      heading: 'Options',
      body: 'Mode selects expand, compress or validate, and the two text modes return the address alone in a code block ready to copy. Lowercase output decides whether the result keeps the case you typed or is converted to lower case; validation always reports the original spelling alongside its verdict.',
    },
    {
      heading: 'Rules and caveats',
      body: 'At most one :: may appear, standing for the run of zero hextets, and it must leave at least one hextet implied; without :: an address needs exactly eight. An embedded IPv4 tail such as ::ffff:192.0.2.1 is accepted, and a zone identifier like %eth0 is allowed when it uses only letters, digits, dot, underscore and hyphen. Compression picks the longest run of zero hextets and breaks ties on the first, which matches the usual convention but need not match every canonicaliser byte for byte.',
    },
    {
      heading: 'Checked in the browser',
      body: 'Address parsing and formatting happen in your tab and no address is transmitted. That matters because an IPv6 address can identify a customer network or your own infrastructure, and the tool keeps working offline.',
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
  related: ['cidr-calculator', 'punycode'],
  status: 'stable',
};
