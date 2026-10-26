/**
 * Editorial content for the warning-header tool page.
 *
 * Kept out of ``warning-header.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does Warning carry?',
      a: 'A warn-code (a 3-digit integer), warn-agent, warn-text in quotes, and an optional warn-date — all per RFC 7234.',
    },
    {
      q: 'Why is Warning obsolete?',
      a: 'The header was deprecated in later specs, but some caches still emit the 1xx/2xx codes, so tools often must recognize them.',
    },
    {
      q: 'How do I compare codes?',
      a: 'Codes from 100–199 relate to the current response only; 200–299 persist across caches. Lower is generally more informative.',
    },
  ],
} as const;
