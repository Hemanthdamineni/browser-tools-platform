/**
 * Editorial content for the access-control-allow-methods-headers tool page.
 *
 * Kept out of ``access-control-allow-methods-headers.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'When are these headers used?',
      a: 'The browser sends a CORS preflight (OPTIONS) request before non-simple requests; these headers tell it which methods and headers the server accepts.',
    },
    {
      q: 'What is a wildcard grant?',
      a: 'A * value answers that any of the simple methods or safe headers are allowed, but it cannot be combined with credentials in some cases.',
    },
    {
      q: 'What counts as a simple method?',
      a: 'GET, HEAD, and POST are simple; most others (PUT, DELETE, PATCH) trigger a preflight.',
    },
  ],
} as const;
