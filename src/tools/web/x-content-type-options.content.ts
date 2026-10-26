/**
 * Editorial content for the x-content-type-options tool page.
 *
 * Kept out of ``x-content-type-options.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Reading and writing the nosniff header',
      body: 'This tool checks or generates an X-Content-Type-Options response header, whose only defined value is nosniff. Analyze mode returns a table with the value, a Valid or Invalid status and a short assessment. Build mode emits the header line X-Content-Type-Options: nosniff, ready for a server or CDN configuration.',
    },
    {
      heading: 'When to check the header',
      body: 'Reach for it when hardening a site or reviewing a scan that reports the header missing or malformed. It is a recommended header for any HTML, CSS or JavaScript a browser reads, and especially for CDNs and static hosts, where a stray upload can otherwise be served as an unexpected type.',
    },
    {
      heading: 'Analyze versus build',
      body: 'Mode switches between analyzing and building. In analyze mode the pasted text is the value under test: nosniff passes, none is flagged as undefined, and anything else is reported as unrecognised. In build mode the value dropdown picks the directive to emit, and choosing none is refused since it would disable the protection.',
    },
    {
      heading: 'Only nosniff is defined',
      body: 'Only nosniff is defined by the specification; other tokens are ignored by browsers and usually signal a legacy or broken configuration, so the tool flags them. The check is case-insensitive and trims whitespace. The header does not replace a correct Content-Type: nosniff only makes the declared type authoritative, so a wrong type stays wrong.',
    },
    {
      heading: 'Where the value is validated',
      body: 'Validation happens entirely in your browser. Nothing you paste is sent anywhere, the tool works offline, and checking a header value never exposes it to a third party.',
    },
  ],
  faq: [
    {
      q: 'What does nosniff do?',
      a: 'It tells the browser not to guess a file type from its content; the declared Content-Type is authoritative, reducing drive-by download and injection risk.',
    },
    {
      q: 'Is any other value valid?',
      a: 'Only nosniff is defined. Other values are ignored by browsers and typically indicate a legacy or broken configuration.',
    },
    {
      q: 'When is it required?',
      a: 'It is a recommended security header for any HTML, CSS, or JavaScript delivered to browsers, especially on CDNs and static hosts.',
    },
  ],
} as const;
