/**
 * Editorial content for the if-modified-since tool page.
 *
 * Kept out of ``if-modified-since.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What happens when the resource has not changed?',
      a: 'A server may return 304 Not Modified without a response body, allowing the client to reuse its cached representation.',
    },
    {
      q: 'What date format should I send?',
      a: 'Use IMF-fixdate, for example Wed, 21 Oct 2015 07:28:00 GMT. Servers must accept older formats but send the modern form.',
    },
    {
      q: 'Is this as precise as an entity tag?',
      a: 'No. HTTP dates have one-second granularity and can miss changes made within the same second; ETags are generally more reliable.',
    },
  ],
} as const;
