/**
 * Editorial content for the critical-ch tool page.
 *
 * Kept out of ``critical-ch.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does Critical-CH do?',
      a: 'It tells a browser that listed client hints are critical to the response, which can influence retry behavior when the first request lacked them.',
    },
    {
      q: 'Is Critical-CH an opt-in?',
      a: 'Accept-CH advertises requested hints; Critical-CH marks a subset as necessary. Browser support and retry behavior vary.',
    },
    {
      q: 'Can it affect caching?',
      a: 'Yes. Responses that vary by hints need matching Vary and cache-key policy to avoid incorrect variants.',
    },
  ],
} as const;
