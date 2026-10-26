/**
 * Editorial content for the base58 tool page.
 *
 * Kept out of ``base58.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'How Base58 encoding works here',
      body: 'The tool turns UTF-8 text into a Base58 string using Bitcoin big-integer arithmetic, or decodes a Base58 string back to text. Encoding reports the input byte count and the output character count; decoding reports the decoded byte count.',
    },
    {
      heading: 'When to use Base58 rather than Base64',
      body: 'It suits short identifiers people copy by hand or read aloud, because dropping 0, O, I and l removes the characters most often confused. That is why Bitcoin addresses and IPFS CIDs use it.',
    },
    {
      heading: 'Choosing the direction',
      body: 'Direction is the only option: Text to Base58 encodes and Base58 to Text decodes. A blank input returns a blank output rather than an error.',
    },
    {
      heading: 'The alphabet rules out some characters',
      body: 'Decoding any character outside the thirty-eight-symbol alphabet raises an error naming the offending character. The output is plain Base58 with no version byte and no checksum, so it is not Base58Check, and leading 1 characters round-trip zero bytes in both directions.',
    },
    {
      heading: 'Everything is computed locally',
      body: 'All conversion is big-integer arithmetic in this tab, so your text is never sent anywhere.',
    },
  ],
  faq: [
    {
      q: 'Which alphabet does this use?',
      a: 'The Bitcoin/IPFS alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz. It drops 0, O, I and l so the value is hard to mis-transcribe.',
    },
    {
      q: 'Is this Base58Check?',
      a: 'No. There is no version byte or checksum — it is plain Base58 of the raw bytes. Base58Check (used for Bitcoin addresses) adds a 4-byte double-SHA-256 checksum on top.',
    },
    {
      q: 'Why do some results start with "1"?',
      a: 'Each leading zero byte in the input becomes one leading "1" in the output, because "1" is the zero digit. Decoding turns them back into zero bytes.',
    },
  ],
} as const;
