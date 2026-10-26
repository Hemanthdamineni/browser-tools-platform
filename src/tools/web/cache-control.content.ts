/**
 * Editorial content for the cache-control tool page.
 *
 * Kept out of ``cache-control.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Does no-cache mean do not store?',
      a: 'No. no-cache allows storage but requires validation before reuse. Use no-store when a response must not be stored.',
    },
    {
      q: 'What is s-maxage?',
      a: 's-maxage sets a freshness lifetime for shared caches such as CDNs and overrides max-age there. It does not by itself prevent browser caching.',
    },
    {
      q: 'Can this know whether a response is safe to cache?',
      a: 'No. It can flag suspicious combinations such as public caching with sensitive-looking headers, but cache safety depends on content, authorization, and deployment context.',
    },
  ],
} as const;
