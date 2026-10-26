/**
 * Editorial content for the hex tool page.
 *
 * Kept out of ``hex.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Two directions over the same bytes',
      body: 'Encoding reads your text as UTF-8 and prints each byte as two hexadecimal digits; decoding does the reverse, parsing hex pairs back into bytes and decoding them as UTF-8 text. Nothing is interpreted as a number, so an arbitrary character string survives the trip unchanged.',
    },
    {
      heading: 'Choosing separators and case',
      body: 'The separator option shapes encoding output for whichever consumer you have: no separator for a compact blob, a space or colon between bytes for logs and certificates, a 0x prefix for C-style arrays and \\x for Python or shell escapes. Uppercase switches the digits themselves. In decode direction the separators do not matter — all of them are stripped before parsing.',
    },
    {
      heading: 'Errors it catches for you',
      body: 'An odd number of hex digits is rejected with an explanation instead of being padded, because a missing nibble means the input was truncated. On decode, bytes that are not valid UTF-8 produce U+FFFD replacement characters and the result carries a note, which tells you the payload was probably binary or in another encoding.',
    },
    {
      heading: 'Byte-for-byte local conversion',
      body: 'Both directions use the TextEncoder and TextDecoder built into the browser, so no library is downloaded and no request leaves the page. You can paste private keys or tokens here to inspect their bytes without the value being transmitted anywhere.',
    },
  ],
  faq: [
    {
      q: 'What input does decoding accept?',
      a: 'Any hex string. Spaces, colons, newlines, 0x and \\x prefixes are ignored, so you can paste output from most tools directly.',
    },
    {
      q: 'What counts as one byte when encoding?',
      a: 'Two hex digits. Encoding always works on UTF-8 bytes, so a non-ASCII character such as é becomes two bytes, c3 a9. Decoding refuses an odd number of hex digits outright rather than guessing where the byte boundary falls.',
    },
    {
      q: 'Why do I see replacement characters after decoding?',
      a: 'The decoder always interprets the bytes as UTF-8. Bytes that are not valid UTF-8 are replaced with U+FFFD and the tool adds a note, so a mangled result is flagged instead of quietly returned as if it were correct text.',
    },
  ],
} as const;
