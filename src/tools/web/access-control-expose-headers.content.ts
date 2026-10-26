/**
 * Editorial content for the access-control-expose-headers tool page.
 *
 * Kept out of ``access-control-expose-headers.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does Access-Control-Expose-Headers do?',
      a: 'It whitelists response headers that cross-origin scripts are allowed to read. By default only a small set of safe headers is exposed.',
    },
    {
      q: 'Does the wildcard work with credentials?',
      a: 'No. When Access-Control-Allow-Credentials: true is set, the value cannot be a wildcard and must name specific headers.',
    },
    {
      q: 'How do I read custom headers cross-origin?',
      a: 'Add each custom header name here so the browser lets scripts access it from a cross-origin fetch.',
    },
  ],
} as const;
