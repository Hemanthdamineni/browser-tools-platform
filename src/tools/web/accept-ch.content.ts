/**
 * Editorial content for the accept-ch tool page.
 *
 * Kept out of ``accept-ch.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Does Accept-CH send hints immediately?',
      a: 'It opts a browser into sending requested hints on subsequent requests when policy and browser support allow it; it is not a request header.',
    },
    {
      q: 'Why might Vary matter?',
      a: 'Responses that vary by client-hint values generally need an appropriate Vary strategy to avoid serving one client’s variant to another.',
    },
    {
      q: 'Are all hints privacy-neutral?',
      a: 'No. Some high-entropy hints can increase fingerprinting surface and may require Permissions-Policy or explicit delegation.',
    },
  ],
} as const;
