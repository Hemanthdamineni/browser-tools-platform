/**
 * Editorial content for the unicode-escape tool page.
 *
 * Kept out of ``unicode-escape.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Which forms does unescape understand?',
      a: 'It accepts them all at once: \\uXXXX, \\u{XXXXX}, \\xXX, \\UXXXXXXXX, &#DDDD;, &#xHHHH;, U+XXXX and CSS \\HHHHHH. Mix and match in one input.',
    },
  ],
} as const;
