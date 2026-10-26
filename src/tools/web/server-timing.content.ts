/**
 * Editorial content for the server-timing tool page.
 *
 * Kept out of ``server-timing.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Where is Server-Timing exposed?',
      a: 'Browsers can expose response Server-Timing metrics through the PerformanceServerTiming API when the response and cross-origin policy allow it.',
    },
    {
      q: 'Is dur required?',
      a: 'No. A metric can be a simple milestone such as cache; a duration is optional.',
    },
    {
      q: 'Should sensitive data go in descriptions?',
      a: 'No. Header values can be observable to clients, logs, and intermediaries. Avoid secrets, user data, and internal details.',
    },
  ],
} as const;
