/**
 * Editorial content for the priority-header tool page.
 *
 * Kept out of ``priority-header.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Does urgency 0 guarantee first delivery?',
      a: 'No. It expresses relative urgency to the server and intermediary scheduler; congestion, dependencies, and implementation policy still decide delivery.',
    },
    {
      q: 'What does i mean?',
      a: 'The incremental parameter indicates that incremental delivery is acceptable for the response, such as progressively loading a resource.',
    },
    {
      q: 'Is this the old HTTP/2 dependency tree?',
      a: 'No. This uses the modern RFC 9218 Priority field syntax rather than obsolete HTTP/2 priority trees.',
    },
  ],
} as const;
