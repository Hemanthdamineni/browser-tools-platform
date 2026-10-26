/**
 * Editorial content for the origin-header tool page.
 *
 * Kept out of ``origin-header.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'When is Origin sent?',
      a: 'Browsers send Origin on CORS requests, POSTs, and same-origin requests in newer specs; it is omitted on most same-origin GETs.',
    },
    {
      q: 'Why is the value null?',
      a: 'A null Origin indicates a sandboxed or downgraded context (file://, sandboxed iframe), which servers often reject or treat cautiously.',
    },
    {
      q: 'How does Origin help CSRF defense?',
      a: 'Comparing the Origin against an allowlist rejects requests from foreign websites. It complements same-site cookies and CSRF tokens.',
    },
  ],
} as const;
