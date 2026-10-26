/**
 * Editorial content for the expect-header tool page.
 *
 * Kept out of ``expect-header.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does 100-continue do?',
      a: 'It lets a client ask the server to approve request headers before sending a potentially large request body.',
    },
    {
      q: 'Does this guarantee a 100 response?',
      a: 'No. Servers and intermediaries may ignore, reject, or mishandle the expectation; clients need a timeout and fallback strategy.',
    },
    {
      q: 'Can I use custom expectations?',
      a: 'Extensions are possible in theory, but interoperability is limited. This tool flags them for review rather than claiming universal support.',
    },
  ],
} as const;
