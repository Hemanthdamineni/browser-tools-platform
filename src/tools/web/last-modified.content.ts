/**
 * Editorial content for the last-modified tool page.
 *
 * Kept out of ``last-modified.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'How is Last-Modified used?',
      a: 'Clients can send the value in If-Modified-Since to revalidate cached content and potentially receive 304 Not Modified.',
    },
    {
      q: 'Is it as precise as an ETag?',
      a: 'No. Dates have one-second granularity and can miss rapid updates; entity tags are usually stronger validators.',
    },
    {
      q: 'Can the date be in the future?',
      a: 'It should normally reflect the representation’s modification time, so future values often indicate clock skew or bad source metadata.',
    },
  ],
} as const;
