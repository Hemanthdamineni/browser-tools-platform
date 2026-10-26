/**
 * Editorial content for the cache-status tool page.
 *
 * Kept out of ``cache-status.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is Cache-Status?',
      a: 'It is an RFC 9211 structured field that lets caches describe the outcome for one stored response, aiding debugging without exposing cache internals to clients in a volatile way.',
    },
    {
      q: 'Which parameters are defined?',
      a: 'ttl, hit-or-miss, stale, collapsed, stored, partial, waiting, and fwd (with its reason sub-parameter). Others behavior is implementation-defined.',
    },
    {
      q: 'How does it differ from Cache-Control?',
      a: 'Cache-Control is a request from the origin for the cache. Cache-Status records what the cache actually did. A debug header typically appended by the cache itself.',
    },
  ],
} as const;
