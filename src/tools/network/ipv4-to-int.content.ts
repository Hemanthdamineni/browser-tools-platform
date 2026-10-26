/**
 * Editorial content for the ipv4-to-int tool page.
 *
 * Kept out of ``ipv4-to-int.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Two directions, one input',
      body: 'Paste either a dotted-quad IPv4 address such as 192.168.1.1 or an unsigned integer such as 3232235777 and the tool converts it to the other form. A dotted address becomes its 32-bit integer and an integer becomes its dotted address, and with the default setting both forms are shown side by side so you can check your work. The conversion is a plain base-256 digit shift, not an IP-to-country or any network operation.',
    },
    {
      heading: 'When you need this number',
      body: 'The integer form shows up in database columns that store addresses as numbers, in access-log entries written by software that logs a long instead of dotted-quad, and in range arithmetic where it is easier to compare two integers than two dotted strings. It is also the compact form you often see in config files and old firewall rules.',
    },
    {
      heading: 'What is accepted and what is not',
      body: 'A dotted address must be exactly four octets of 0 to 255; a fourth octet of 256, a letter, or five parts is rejected rather than silently clamped. An integer must be between 0 and 4294967295 — anything larger does not fit a 32-bit IPv4 address and is refused. The showBoth switch controls whether the result is paired with the form you gave it or returned bare.',
    },
    {
      heading: 'The limits of the format',
      body: 'This tool deals with IPv4 only, which is a 32-bit space. IPv6 addresses are a completely different 128-bit format handled by the IPv6 expander, and this converter will not guess at one. Leading zeros in an octet are accepted as plain numbers, so 192.168.001.1 is the same address as 192.168.1.1.',
    },
    {
      heading: 'It is a pure local conversion',
      body: 'The math is a few multiplications and divisions done in this tab. Nothing is sent to a network, no address is queried, and the tool works offline — so you can convert addresses from a private internal range without broadcasting them anywhere.',
    },
  ],
  faq: [
    {
      q: 'Which input do I give?',
      a: 'Either one — a dotted IPv4 (1.2.3.4) or an unsigned integer between 0 and 4294967295. The tool detects and converts to the other form.',
    },
    {
      q: 'What range is valid?',
      a: 'Integer values 0 … 4294967295 (0.0.0.0 … 255.255.255.255). Values outside that range or malformed octets (256, letters, too many parts) are rejected.',
    },
    {
      q: 'Is this the same as a subnet calculator?',
      a: 'No — it converts one address to its numeric form. For prefix, range or subnet math use the CIDR calculator; this complements it.',
    },
  ],
} as const;
