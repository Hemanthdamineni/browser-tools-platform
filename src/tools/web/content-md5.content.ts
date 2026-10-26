/**
 * Editorial content for the content-md5 tool page.
 *
 * Kept out of ``content-md5.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The legacy header, computed or checked',
      body: 'Build mode hashes the UTF-8 bytes of the entered text with MD5 and returns the Base64 value that Content-MD5 expects, with a stats line for the byte count. Analyze mode recomputes the digest and compares it with the Base64 value you paste, reporting Match, Mismatch or Invalid in a three-column table.',
    },
    {
      heading: 'Interoperability audits, not security',
      body: 'The useful case is legacy integration work: an old client library still sends Content-MD5, a third-party endpoint still checks it, or you are auditing what a system actually computes. If you are choosing an integrity mechanism today, use Content-Digest or a cryptographic signature instead — and the tool tells you as much in its warning.',
    },
    {
      heading: 'The two options',
      body: 'Mode picks build or verify. In verify mode, Expected Content-MD5 takes the Base64 value to compare against, and a value that does not match the 22-character Base64 MD5 shape is reported as Invalid rather than as a mismatch. In build mode the digest field is ignored.',
    },
    {
      heading: 'Caveats',
      body: 'MD5 is collision-weak, so the header proves nothing about authenticity, and it is deprecated by RFC 7231. The tool hashes the UTF-8 encoding of the text you enter, which must match the representation bytes the sender hashed — a server that hashed a compressed body will disagree. It is a per-message checksum, not a signature.',
    },
    {
      heading: 'Digested in the tab',
      body: 'The hash and the comparison run entirely in your browser and no request is made, so a header value or a log snippet can be checked without sending it anywhere. It works offline.',
    },
  ],
  faq: [
    {
      q: 'Is Content-MD5 secure?',
      a: 'No. MD5 is collision-weak and Content-MD5 is not an authenticity mechanism. Prefer Content-Digest or a cryptographic signature for modern systems.',
    },
    {
      q: 'What bytes are hashed?',
      a: 'This tool hashes the UTF-8 encoding of the entered text, which must match the representation bytes used by the sender.',
    },
    {
      q: 'Does this make a network request?',
      a: 'No. Digest computation and verification run entirely in your browser.',
    },
  ],
} as const;
