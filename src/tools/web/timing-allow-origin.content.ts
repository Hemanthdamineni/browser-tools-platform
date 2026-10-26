/**
 * Editorial content for the timing-allow-origin tool page.
 *
 * Kept out of ``timing-allow-origin.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does Timing-Allow-Origin control?',
      a: 'It whitelists origins that are allowed to read cross-origin resource timing metrics from PerformanceResourceTiming.',
    },
    {
      q: 'What does the wildcard grant?',
      a: 'A * value allows any origin to read timing data, which can expose load-duration details.',
    },
    {
      q: 'Is it related to CORS?',
      a: 'It is a separate header from CORS but serves a similar allowlisting role specifically for performance timing data.',
    },
  ],
} as const;
