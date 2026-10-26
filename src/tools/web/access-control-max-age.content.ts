/**
 * Editorial content for the access-control-max-age tool page.
 *
 * Kept out of ``access-control-max-age.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does this header do?',
      a: 'It caches a successful CORS preflight so the browser skips the OPTIONS round-trip for subsequent requests within the window.',
    },
    {
      q: 'Is the value always honored?',
      a: 'Browsers cap it: Firefox caps around 25 hours but Chromium historically ~5 minutes (600s), and some ignore it entirely, so do not rely on it.',
    },
    {
      q: 'When should I omit it?',
      a: 'If you change CORS rules often, a short value or omission avoids stale preflight caches during rollout.',
    },
  ],
} as const;
