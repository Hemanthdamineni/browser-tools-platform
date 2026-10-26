/**
 * Editorial content for the ipv6-expander tool page.
 *
 * Kept out of ``ipv6-expander.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Expanding, compressing and validating',
      body: 'Give it an IPv6 address and it either writes out all eight hextets zero-padded to four digits (2001:0db8:0000:0000:0000:0000:0000:0001), strips the leading zeros and re-applies the :: shorthand (2001:db8::1), or checks the grammar and reports Valid or Invalid with a reason. Several addresses separated by spaces or commas are validated together as a table.',
    },
    {
      heading: 'When a full address is what you need',
      body: 'Expanded form is what network gear, log parsers, ACLs and regular expressions often demand, and it is the shape that makes two addresses comparable by eye. Use it to confirm that two differently-written addresses are really the same host, or to prepare an address for a firewall rule.',
    },
    {
      heading: 'Options',
      body: 'Mode selects expand, compress or validate, and the two text modes return the address alone in a code block ready to copy. Lowercase output decides whether the result keeps the case you typed or is converted to lower case; validation always reports the original spelling alongside its verdict.',
    },
    {
      heading: 'Rules and caveats',
      body: 'At most one :: may appear, standing for the run of zero hextets, and without :: an address needs exactly eight. An embedded IPv4 tail such as ::ffff:192.0.2.1 is accepted, and a zone identifier like %eth0 is allowed when it uses only letters, digits, dot, underscore and hyphen. Compression picks the longest run of zero hextets, matching the usual convention though not every canonicaliser byte for byte.',
    },
    {
      heading: 'Checked in the browser',
      body: 'Address parsing and formatting happen in your tab and no address is transmitted. That matters because an IPv6 address can identify a customer network or your own infrastructure, and the tool keeps working offline.',
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
} as const;
