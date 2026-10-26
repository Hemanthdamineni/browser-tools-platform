/**
 * Editorial content for the alt-svc tool page.
 *
 * Kept out of ``alt-svc.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Does Alt-Svc redirect a request?',
      a: 'No. It advertises an alternative connection route; clients may continue using the origin and can fall back if the alternative fails.',
    },
    {
      q: 'What does ma mean?',
      a: 'ma is the freshness lifetime in seconds for the alternate-service mapping.',
    },
    {
      q: 'Does this test HTTP/3 connectivity?',
      a: 'No. It validates field syntax locally and never makes a network request.',
    },
  ],
} as const;
