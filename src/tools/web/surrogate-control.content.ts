/**
 * Editorial content for the surrogate-control tool page.
 *
 * Kept out of ``surrogate-control.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Who reads Surrogate-Control?',
      a: 'Reverse proxies and surrogate caches may use it to control intermediary behavior; ordinary browsers generally do not use it as their cache policy.',
    },
    {
      q: 'What does content mean?',
      a: 'The content directive can identify surrogate processing technologies, such as ESI, supported by an intermediary.',
    },
    {
      q: 'Is this a universal CDN standard?',
      a: 'Support and precedence vary by proxy or CDN. Verify the target provider documentation before relying on it.',
    },
  ],
} as const;
