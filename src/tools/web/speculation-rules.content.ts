/**
 * Editorial content for the speculation-rules tool page.
 *
 * Kept out of ``speculation-rules.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Where does this header go?',
      a: 'Serve a Speculation-Rules header naming an external JSON file, or inline the rules with a <script type="speculationrules"> element.',
    },
    {
      q: 'What is eagerness?',
      a: 'How eagerly the browser starts prefetching/prerendering: from immediate/eager down to moderate/conservative.',
    },
    {
      q: 'Why prerender over prefetch?',
      a: 'Prerender renders the page up front for faster navigation but costs more resources; prefetch only warms the network response.',
    },
  ],
} as const;
