/**
 * Editorial content for the reporting-endpoints tool page.
 *
 * Kept out of ``reporting-endpoints.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is Reporting-Endpoints?',
      a: 'It is part of the Reporting API and configures where browsers should send reports such as CSP violations or deprecation warnings.',
    },
    {
      q: 'Does a group need HTTPS?',
      a: 'Reporting endpoints must be HTTPS in modern browsers; HTTP is permitted only for localhost origins.',
    },
    {
      q: 'What does priority control?',
      a: 'The optional priority parameter (0-255) controls connection pooling priority for the endpoint; it does not change report routing between groups.',
    },
  ],
} as const;
