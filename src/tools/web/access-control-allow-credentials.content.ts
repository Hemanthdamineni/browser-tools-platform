/**
 * Editorial content for the access-control-allow-credentials tool page.
 *
 * Kept out of ``access-control-allow-credentials.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does this header do?',
      a: 'It tells the browser to allow credentialed cross-origin requests (cookies, auth headers) to read the response, when the request used withCredentials.',
    },
    {
      q: 'Can it combine with a wildcard?',
      a: 'No. When credentials are allowed, Access-Control-Allow-Origin must name the specific origin and cannot be *.',
    },
    {
      q: 'Is false a valid value?',
      a: 'The CORS spec defines only true; a false value is non-standard and generally treated as absent.',
    },
  ],
} as const;
