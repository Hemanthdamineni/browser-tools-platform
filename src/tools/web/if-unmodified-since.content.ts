/**
 * Editorial content for the if-unmodified-since tool page.
 *
 * Kept out of ``if-unmodified-since.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What happens when the resource changed?',
      a: 'A server commonly returns 412 Precondition Failed instead of applying the update, preventing an accidental overwrite.',
    },
    {
      q: 'Is this stronger than If-Match?',
      a: 'No. Dates have one-second granularity and can miss rapid changes; If-Match with a strong ETag is generally safer for concurrency control.',
    },
    {
      q: 'Can I use this with GET?',
      a: 'It can be sent with several methods, but it is most useful for state-changing requests that must not overwrite a newer representation.',
    },
  ],
} as const;
