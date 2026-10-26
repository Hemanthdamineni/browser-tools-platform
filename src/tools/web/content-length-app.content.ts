/**
 * Editorial content for the content-length-app tool page.
 *
 * Kept out of ``content-length-app.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Counting the bytes of a body',
      body: 'Paste a request or response body and the tool reports its exact UTF-8 byte length, the JavaScript string length, the line count and the average bytes per character. Because UTF-16 string length and UTF-8 byte length disagree for any non-ASCII text, the mismatch line shows precisely where a declared Content-Length would go wrong.',
    },
    {
      heading: 'Fix the header that truncates requests',
      body: 'A body containing an accent, a currency sign or an emoji is longer in bytes than in characters, so a Content-Length copied from a character count is too small and the request is cut in half. Pasting the body here gives the number that actually belongs in the header and proves the difference.',
    },
    {
      heading: 'Analyze versus verify',
      body: 'Analyze mode breaks the body down and reports the size table. Verify mode takes a declared Content-Length and compares it with the measured bytes, reporting a match, or the exact byte difference in either direction. Both modes normalise CRLF line endings to LF before counting.',
    },
    {
      heading: 'What it does not cover',
      body: 'Only bodies that declare a length can be checked, so chunked transfer encoding is out of scope. A declared value must be a non-negative integer or the tool says so instead of guessing. The measurement is UTF-8 by definition, so a body in another encoding needs converting first.',
    },
    {
      heading: 'Measured in your browser',
      body: 'Encoding and counting use the page, not a server, so the body never leaves your device. It works offline, and a body containing tokens or personal data is measured without being transmitted anywhere.',
    },
  ],
  faq: [
    {
      q: 'Why does byte length differ from string length?',
      a: 'JavaScript strings count UTF-16 code units, so non-ASCII characters (é, emoji) use multiple bytes in UTF-8.',
    },
    {
      q: 'When does Content-Length matter?',
      a: 'A wrong Content-Length wrong corrupts HTTP/1.1 bodies; mismatches can cause truncation or desync. 2 bytes per multibyte character is a common source.',
    },
    {
      q: 'What about chunked?',
      a: 'Chunked transfer encoding omits Content-Length; this tool is for bodies that declare a length.',
    },
  ],
} as const;
