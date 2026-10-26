/**
 * Editorial content for the alt-used tool page.
 *
 * Kept out of ``alt-used.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is Alt-Used?',
      a: 'A request header that tells the origin server which alternative service the client used, matching the Alt-Svc offered for that origin.',
    },
    {
      q: 'When is it sent?',
      a: 'A client sends Alt-Used when it successfully connects to an alternative per the Alt-Svc of that origin, after ALPN offers HTTP/2 or HTTP/3.',
    },
    {
      q: 'How does it compare to Alt-Svc?',
      a: 'Alt-Svc is sent by the server advertising alternatives; Alt-Used is sent by the client confirming which alternative it actually used.',
    },
  ],
} as const;
