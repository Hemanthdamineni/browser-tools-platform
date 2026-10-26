/**
 * Editorial content for the x-robots-tag tool page.
 *
 * Kept out of ``x-robots-tag.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'How does X-Robots-Tag differ from robots.txt?',
      a: 'robots.txt is a site-wide crawl file; X-Robots-Tag is a per-URL header (or meta tag equivalent) applied at fetch time.',
    },
    {
      q: 'What do the core directives do?',
      a: 'noindex stops indexing; nofollow stops following links; noarchive stops caching; nosnippet restricts snippets; max-snippet:N caps snippet length.',
    },
    {
      q: 'Can it target specific crawlers?',
      a: 'Yes — a group such as "googlebot: noindex" confines the rule to that user agent, and a value may contain multiple groups.',
    },
  ],
} as const;
