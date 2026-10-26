/**
 * Editorial content for the traceparent tool page.
 *
 * Kept out of ``traceparent.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does the sampled flag mean?',
      a: 'The least-significant bit of trace flags indicates that the trace may be sampled; it is a propagation hint, not a guarantee that data was collected.',
    },
    {
      q: 'Can I invent a trace ID?',
      a: 'Use a random 16-byte trace ID and 8-byte parent ID in production. This tool validates supplied values but does not generate randomness.',
    },
    {
      q: 'Does this contact a tracing backend?',
      a: 'No. It only validates and formats header text locally.',
    },
  ],
} as const;
