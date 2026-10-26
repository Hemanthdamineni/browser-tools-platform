/**
 * Editorial content for the forwarded-header tool page.
 *
 * Kept out of ``forwarded-header.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Can Forwarded be trusted for authentication?',
      a: 'Only when a trusted proxy controls and sanitizes it. Clients can send arbitrary header values directly unless the deployment strips and rewrites them.',
    },
    {
      q: 'How are IPv6 addresses represented?',
      a: 'IPv6 addresses in a host value are commonly enclosed in square brackets, such as [2001:db8::1].',
    },
    {
      q: 'What does an underscore value mean?',
      a: 'An obfuscated identifier can protect topology or client details. It is not an IP address and should not be parsed as one.',
    },
  ],
} as const;
