/**
 * Editorial content for the ip-address-inspector tool page.
 *
 * Kept out of ``ip-address-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it parses',
      body: 'Give it an IPv4 address, an IPv6 address, either with a port, bracketed IPv6 such as [::1]:443, an IPv4-mapped form like ::ffff:192.168.1.42, or an IPv6 zone identifier such as fe80::a1b2:c3d4%eth0. The tool splits and validates the address, then reports its version, octets or 16-bit groups, hex and binary forms, and the compressed IPv6 spelling. A port is validated as 0–65535 and an embedded IPv4 is extracted from the mapped form.',
    },
    {
      heading: 'Classification, not a lookup',
      body: 'Every address is matched against the IANA special-purpose ranges: RFC 1918 private space, loopback, APIPA link-local, carrier-grade NAT, the documentation TEST-NETs, benchmarking space, multicast, the limited broadcast and reserved blocks for IPv4, and ULA, link-local, site-local, multicast, documentation and IPv4-mapped for IPv6. Ordinary addresses fall through to global unicast. The result is a set of labels plus a scope verdict of public or non-public.',
    },
    {
      heading: 'Why the two spellings of an IPv6 address matter',
      body: 'The same IPv6 address has a long fully-expanded form and a short compressed form with :: for the longest run of zero groups. Seeing both side by side is the quickest way to confirm that two configs or log lines actually refer to the same host — a mismatch that is otherwise easy to miss when one is expanded and the other is not.',
    },
    {
      heading: 'Scope and privacy',
      body: 'This tool inspects a single address only, so there is no prefix, broadcast or host-count math — that belongs to the CIDR Calculator. Classification is local and complete: there is no DNS lookup, no geolocation call and no request of any kind, so an address from a private network stays entirely on your device.',
    },
  ],
  faq: [
    {
      q: 'Is my IP looked up online?',
      a: 'No. All parsing and classification is done locally in your browser tab.',
    },
    {
      q: 'How are IPv6 link-local addresses shown?',
      a: 'They are classified as link-local and their expanded 16-bit groups are listed; a zone identifier such as %eth0 is reported separately.',
    },
    {
      q: 'What is an IPv4-mapped IPv6 address?',
      a: 'The ::ffff:a.b.c.d form embeds an IPv4 address in the last 32 bits of an IPv6 address. The tool detects it and reports the embedded IPv4 address.',
    },
    {
      q: 'Does it handle CIDR blocks too?',
      a: 'No — this tool inspects a single address. For network math (prefix, range, broadcast, host count), use the CIDR Calculator instead.',
    },
  ],
} as const;
