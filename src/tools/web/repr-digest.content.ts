/**
 * Editorial content for the repr-digest tool page.
 *
 * Kept out of ``repr-digest.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Building and verifying the digest field',
      body: 'This tool computes or checks an RFC 9530 Repr-Digest for UTF-8 text. Build mode returns the field as sha-256=: followed by a base64 SHA-256 value in colons. Verify mode recomputes the digest and compares it with the expected value you supply, reporting Match, Mismatch or Invalid in a small table.',
    },
    {
      heading: 'When a representation digest helps',
      body: 'Reach for it to hand a client a representation hash so it can detect corruption in transit, or to check a Repr-Digest header you received. It also helps debug an integrity mismatch by showing whether the exact text and the header value agree.',
    },
    {
      heading: 'The mode switch and expected value',
      body: 'Mode chooses building or verifying; in verify mode the digest option holds the expected value. The tool first checks that value shape with a strict pattern, reporting Invalid when it is not a well-formed sha-256 field, then compares it byte-for-byte with the computed digest.',
    },
    {
      heading: 'What Repr-Digest does not prove',
      body: 'This tool hashes the UTF-8 bytes of the text you enter, while a real deployment must hash the exact representation bytes its protocol specifies. A digest detects accidental change only and does not authenticate the producer, so use a signature for authenticity. Content-Digest covers message content after codings, which is a different field.',
    },
    {
      heading: 'Where the hash is computed',
      body: 'The hashing runs locally through the browser crypto API. Your text is never uploaded and no request is made, so a digest can be checked offline.',
    },
  ],
  faq: [
    {
      q: 'How is Repr-Digest different from Content-Digest?',
      a: 'Repr-Digest identifies the selected representation, while Content-Digest identifies message content after transfer/content codings are considered.',
    },
    {
      q: 'Is this an authenticity signature?',
      a: 'No. A digest detects accidental changes but does not authenticate who produced the representation. Use a signature when authenticity is required.',
    },
    {
      q: 'What bytes are hashed?',
      a: 'This tool hashes the UTF-8 bytes of the entered text. Real deployments must hash the exact representation bytes specified by their protocol.',
    },
  ],
} as const;
