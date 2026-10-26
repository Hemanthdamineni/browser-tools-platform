/**
 * Editorial content for the cdn-cache-control tool page.
 *
 * Kept out of ``cdn-cache-control.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'How does this differ from Cache-Control?',
      a: 'CDN-Cache-Control is commonly used for CDN-specific policy, while Cache-Control is the standardized general cache directive field consumed by browsers and shared caches.',
    },
    {
      q: 'Does a CDN have to honor it?',
      a: 'Only if the CDN supports the field and its documented precedence rules. Treat it as provider-specific behavior, not a universal browser contract.',
    },
    {
      q: 'Are stale responses always safe?',
      a: 'No. Stale serving can expose outdated or user-specific data; pair policies with correct cache keys and privacy controls.',
    },
  ],
} as const;
