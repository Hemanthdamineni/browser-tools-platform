/**
 * Editorial content for the if-range tool page.
 *
 * Kept out of ``if-range.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What happens when If-Range matches?',
      a: 'The server can honor the Range request and return 206 Partial Content. If it does not match, the server sends the complete representation instead.',
    },
    {
      q: 'Why are weak ETags rejected?',
      a: 'If-Range requires a strong validator because partial bytes must correspond to the exact representation.',
    },
    {
      q: 'Does this create a Range header?',
      a: 'No. It validates only the If-Range validator; use the HTTP Range tool to build the byte range separately.',
    },
  ],
} as const;
