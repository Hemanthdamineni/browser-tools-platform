/**
 * Editorial content for the via-header tool page.
 *
 * Kept out of ``via-header.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is the purpose of the Via header?',
      a: 'The Via header tracks intermediaries like gateways or proxies to avoid request loops and diagnose routing issues.',
    },
    {
      q: 'Is the Via header required for all proxies?',
      a: 'Yes. RFC 7230 requires proxies to add Via headers to their forwarded requests and responses.',
    },
  ],
} as const;
