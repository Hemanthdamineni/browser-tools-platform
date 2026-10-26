/**
 * Editorial content for the vary-header tool page.
 *
 * Kept out of ``vary-header.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does Vary do?',
      a: 'It tells a cache that response selection depends on listed request header fields, so those values belong in the cache key.',
    },
    {
      q: 'What does Vary: * mean?',
      a: 'It indicates the response is not suitable for normal cache reuse and is effectively uncacheable by shared caches.',
    },
    {
      q: 'Should Vary include Authorization?',
      a: 'Usually private or authenticated responses need stronger cache controls. Vary alone is not an authorization boundary and cannot make unsafe content safe to cache.',
    },
  ],
} as const;
