/**
 * Editorial content for the trailer-header tool page.
 *
 * Kept out of ``trailer-header.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Does Trailer contain trailing values?',
      a: 'No. It lists field names that may appear after the body. The actual values arrive in trailing headers.',
    },
    {
      q: 'Which fields cannot be trailers?',
      a: 'Routing, framing, authentication, representation-control, and some processing-sensitive fields must not be sent as trailers. Confirm constraints for your HTTP version and intermediary.',
    },
    {
      q: 'Does this enable chunked encoding?',
      a: 'No. It only builds the declaration. Streaming and transfer framing remain server responsibilities.',
    },
  ],
} as const;
