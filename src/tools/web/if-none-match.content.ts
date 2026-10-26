/**
 * Editorial content for the if-none-match tool page.
 *
 * Kept out of ``if-none-match.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What happens when a GET tag matches?',
      a: 'The server commonly returns 304 Not Modified without the response body, allowing the client to reuse its cached representation.',
    },
    {
      q: 'What does * mean for PUT?',
      a: 'It commonly means proceed only when no current representation exists, supporting create-if-absent workflows.',
    },
    {
      q: 'Are weak tags allowed?',
      a: 'Yes. If-None-Match uses weak comparison, so weak tags can participate in cache validation.',
    },
  ],
} as const;
