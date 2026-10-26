/**
 * Editorial content for the retry-after tool page.
 *
 * Kept out of ``retry-after.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Which HTTP responses use Retry-After?',
      a: 'It is commonly used with 429 Too Many Requests and 503 Service Unavailable, but applications may use it with other responses.',
    },
    {
      q: 'What is delta-seconds?',
      a: 'It is a non-negative integer number of seconds to wait from response receipt. It is not a Unix timestamp.',
    },
    {
      q: 'Does this calculate a client-specific retry time?',
      a: 'No. Date-form values are parsed as UTC header dates. Network latency, clock skew, and server policy can affect actual retry timing.',
    },
  ],
} as const;
