/**
 * Editorial content for the prefer-header tool page.
 *
 * Kept out of ``prefer-header.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Does Prefer force a server to honor a request?',
      a: 'No. It expresses a client preference. Servers may honor it, ignore it, or communicate applied preferences with Preference-Applied.',
    },
    {
      q: 'What does wait mean?',
      a: 'wait=n asks the server to wait up to n seconds before responding, when supported.',
    },
    {
      q: 'Are custom preferences allowed?',
      a: 'Yes. Applications can define extension preferences, but both sides must agree on their meaning.',
    },
  ],
} as const;
