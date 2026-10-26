/**
 * Editorial content for the link-header tool page.
 *
 * Kept out of ``link-header.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Does this fetch or verify the linked URI?',
      a: 'No. It only formats and parses header text locally and makes no network requests.',
    },
    {
      q: 'Can a Link header replace an HTML link element?',
      a: 'Some relations and user agents support HTTP Link headers, but support and behavior vary. Verify the target browsers and deployment path.',
    },
    {
      q: 'Why are multiple relations sometimes space-separated?',
      a: 'RFC-style Link values can have a relation type list such as rel="alternate stylesheet". The parser preserves the value and reports duplicate relation tokens.',
    },
  ],
} as const;
