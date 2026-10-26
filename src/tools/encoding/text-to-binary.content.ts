/**
 * Editorial content for the text-to-binary tool page.
 *
 * Kept out of ``text-to-binary.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Eight bits per byte, UTF-8 underneath',
      body: 'Encoding turns the text into UTF-8 bytes and prints each byte as eight binary digits, so "Hi" becomes 01001000 01101001. Because the bytes are UTF-8, an accented letter produces two bytes and an emoji four, and decoding regroups your 0s and 1s into the same bytes and back into text.',
    },
    {
      heading: 'Grouping and separators',
      body: 'The group option lays out eight bits per group (whole bytes) or four (nibbles), and the separator option puts a space between groups or runs them together. Every combination is valid output and the tool reads back any of them, so a result can be pasted straight into the other direction.',
    },
    {
      heading: 'Decoding rules and errors',
      body: 'Decoding strips every character that is not a 0 or a 1, so spaces, tabs and newlines between blocks are ignored and formatted output pastes directly. The bit count must be a multiple of eight; if it is not, the tool refuses with the number of bits it found and the closest valid length rather than padding or truncating.',
    },
    {
      heading: 'Where it helps, and where it runs',
      body: 'Use it to show how a byte is built, to check a flag mask against the bits a device reports, or to produce binary for a puzzle or serial protocol. It is deliberately not a hex or base64 converter, and input is capped at one million characters. Encoding and decoding use the browser\u2019s own TextEncoder and TextDecoder in this tab, with nothing uploaded.',
    },
  ],
  faq: [
    {
      q: 'How are non-ASCII characters handled?',
      a: 'Text is encoded to UTF-8 bytes first, so é, 中, emoji and every other character becomes its own sequence of 8-bit groups. Decoding groups the bits back into the same UTF-8 bytes.',
    },
    {
      q: 'What if my binary string has the wrong length?',
      a: 'Decoding needs a whole number of bytes. If the input is not a multiple of 8 bits, you get a clear error with the length that would be valid instead of a silently corrupt result.',
    },
    {
      q: 'Can I include spaces or newlines in binary input?',
      a: 'Yes — spaces, tabs and newlines between blocks of 0s and 1s are ignored, so you can paste formatted output directly.',
    },
  ],
} as const;
