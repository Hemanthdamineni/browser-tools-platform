/**
 * Editorial content for the expires-header tool page.
 *
 * Kept out of ``expires-header.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Does Expires always control caching?',
      a: 'No. Cache-Control max-age and s-maxage generally take precedence when present; Expires is a legacy-compatible fallback.',
    },
    {
      q: 'What does a past Expires date mean?',
      a: 'It indicates the response is already stale, though other cache directives and validation rules still affect actual behavior.',
    },
    {
      q: 'What format should I send?',
      a: 'Use IMF-fixdate, for example Wed, 21 Oct 2030 07:28:00 GMT. This tool does not make network requests.',
    },
  ],
} as const;
