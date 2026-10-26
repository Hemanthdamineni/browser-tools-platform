/**
 * Editorial content for the if-match tool page.
 *
 * Kept out of ``if-match.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does If-Match protect against?',
      a: 'It lets a client update only if the resource still has a matching entity tag, preventing accidental overwrites after another change.',
    },
    {
      q: 'Are weak tags valid for If-Match?',
      a: 'If-Match uses strong comparison, so weak entity-tags do not satisfy the condition. This tool accepts them for analysis but flags them for review.',
    },
    {
      q: 'What does * mean?',
      a: 'The wildcard matches any current representation, and is useful for operations that should proceed only when a resource exists.',
    },
  ],
} as const;
