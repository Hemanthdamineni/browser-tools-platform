/**
 * Editorial content for the backslash-escape tool page.
 *
 * Kept out of ``backslash-escape.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What happens to an unknown escape like \\q?',
      a: 'The backslash is dropped and the letter is kept ("q"). Every distinct unknown escape is listed in a note under the output.',
    },
    {
      q: 'Which characters get escaped?',
      a: 'Real control characters use their short form (\\n, \\t, \\r, \\f, \\v, \\0), backslash doubles, and every other Unicode "Other" character (control, format, surrogate, private-use) becomes \\xNN, \\uNNNN, or \\u{…}. Ordinary letters, punctuation and spaces pass through unchanged.',
    },
    {
      q: 'When does it raise an error?',
      a: 'Only when unescaping a \\u{…} sequence that is unterminated, is not hexadecimal, or names a code point above U+10FFFF.',
    },
  ],
} as const;
