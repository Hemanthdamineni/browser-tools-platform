/**
 * Editorial content for the content-digest tool page.
 *
 * Kept out of ``content-digest.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Does this hash my content?',
      a: 'No. Paste a digest generated elsewhere or use a file-hashing tool first. This utility only formats and validates digest field syntax.',
    },
    {
      q: 'Is Digest the same as encryption?',
      a: 'No. A digest detects changes when compared against a trusted expected value; it does not conceal content.',
    },
    {
      q: 'Does a valid digest prove integrity?',
      a: 'Only when the algorithm, value, and message context are trusted and the digest is computed over the exact transmitted representation.',
    },
  ],
} as const;
