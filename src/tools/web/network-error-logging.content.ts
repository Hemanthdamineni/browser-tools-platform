/**
 * Editorial content for the network-error-logging tool page.
 *
 * Kept out of ``network-error-logging.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does NEL do?',
      a: 'It asks the browser to report network errors from this origin to the configured reporting endpoint, helping diagnose connectivity issues that bypass application code.',
    },
    {
      q: 'Which fields are required?',
      a: 'report_to and max_age are required. The rest are optional and take defaults per browser.',
    },
    {
      q: 'What does failure_mode choose?',
      a: 'fail-open retains default network behavior when delivery fails; fail-closed asks the browser to block the request outright.',
    },
  ],
} as const;
