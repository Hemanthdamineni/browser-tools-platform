/**
 * Editorial content for the etag tool page.
 *
 * Kept out of ``etag.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is the difference between weak and strong comparison?',
      a: 'Weak comparison treats W/"abc" and "abc" as equivalent. Strong comparison requires both tags to be strong and their opaque values to match exactly.',
    },
    {
      q: 'Does this hash my file or response?',
      a: 'No. It generates tags from the token you provide and never reads files or fetches resources.',
    },
    {
      q: 'What does * mean?',
      a: 'The wildcard matches any current representation in conditional request headers such as If-None-Match and If-Match.',
    },
  ],
} as const;
