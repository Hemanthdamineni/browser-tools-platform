/**
 * Editorial content for the allow-header tool page.
 *
 * Kept out of ``allow-header.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does Allow describe?',
      a: 'It lists methods supported by the target resource, commonly in a 405 Method Not Allowed response. It does not grant permission or bypass authentication.',
    },
    {
      q: 'Should HEAD be listed when GET is supported?',
      a: 'Servers generally support HEAD wherever GET is supported, but explicitly listing it improves clarity and interoperability.',
    },
    {
      q: 'Does this validate an API implementation?',
      a: 'No. It checks header syntax and common method-list concerns only; it cannot test server behavior.',
    },
  ],
} as const;
