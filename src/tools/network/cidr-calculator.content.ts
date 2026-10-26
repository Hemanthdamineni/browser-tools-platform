/**
 * Editorial content for the cidr-calculator tool page.
 *
 * Kept out of ``cidr-calculator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the CIDR calculator returns',
      body: 'Type an address with a prefix, such as 192.168.1.37/24 or 2001:db8:abcd:12::1/64, and it prints a table: address family, the network in CIDR form, first and last address, the exact address count and the prefix length. For IPv4 it adds the netmask, wildcard mask, broadcast address and the conventional usable host count.',
    },
    {
      heading: 'Sizing a subnet or a VLAN',
      body: 'Use it when you are about to carve a range for a VLAN, a container network or a point-to-point link and need to know how many addresses a prefix really contains. Typing the candidate block shows at once whether the range is big enough, where the broadcast falls and whether a /31 would suit a two-endpoint link.',
    },
    {
      heading: 'IPv4 and IPv6 answer differently',
      body: 'IPv6 has no broadcast address, so that row becomes a note and the range is described by first and last address with an exact count. Two IPv4 special cases are called out: a /31 carries the RFC 3021 note about point-to-point links and a /32 is labelled a single address, with the usable-host row adjusted to match.',
    },
    {
      heading: 'What it refuses to guess',
      body: 'Input must be one address and one prefix. Zone identifiers such as fe80::1%eth0 are rejected, only one :: compression marker is allowed, and the prefix must fall between 0 and 32 or 128. IPv4-embedded IPv6 literals like ::ffff:192.0.2.1 are accepted, in both compressed and expanded form.',
    },
    {
      heading: 'Exact arithmetic, entirely local',
      body: 'All maths runs in the page with arbitrary-precision integers, so a /0 IPv6 block reports its true address count instead of a rounded floating-point figure. The address you paste is never sent anywhere and the tool keeps working with no connection at all.',
    },
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
} as const;
