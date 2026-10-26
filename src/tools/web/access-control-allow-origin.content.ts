/**
 * Editorial content for the access-control-allow-origin tool page.
 *
 * Kept out of ``access-control-allow-origin.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does Access-Control-Allow-Origin do?',
      a: 'It tells the browser which origins may read the cross-origin response, enabling CORS for that caller.',
    },
    {
      q: 'Can * be combined with credentials?',
      a: 'No. When Access-Control-Allow-Credentials: true is set, the Allow-Origin value cannot be a wildcard and must name the specific requesting origin.',
    },
    {
      q: 'Why send Vary: Origin?',
      a: 'When the allowed origin is chosen dynamically per request, Vary: Origin prevents caches from serving the wrong origin grant to other callers.',
    },
  ],
} as const;
