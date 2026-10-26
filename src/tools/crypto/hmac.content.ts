/**
 * Editorial content for the hmac tool page.
 *
 * Kept out of ``hmac.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'A message and a shared key, hashed together',
      body: 'Put the message in the main box and the shared secret in the Secret key option and you get a keyed digest over the UTF-8 bytes of both. Pick SHA-1, SHA-256, SHA-384 or SHA-512 and hex or Base64 output; the stats report the key length and the bytes signed.',
    },
    {
      heading: 'The webhook-signature job',
      body: 'Use it to reproduce a signature a provider says it sent: paste the raw request body, paste the signing secret, choose the algorithm the provider documents, and compare your digest with the signature header. Identical digests prove integrity.',
    },
    {
      heading: 'Choosing the algorithm, key and encoding',
      body: 'SHA-256 is the right default for new work; SHA-1 is here for legacy APIs that still demand HMAC-SHA1. The key is passed to Web Crypto as raw UTF-8 bytes, so unusual characters are used exactly as typed. Hex matches most documentation; Base64 is common in HTTP header signatures.',
    },
    {
      heading: 'Caveats that change what it proves',
      body: 'HMAC shows possession of the key and message integrity — it is not encryption, and not a public signature, because verifying it requires the same secret. An empty key is an error and empty input returns empty output; over-long keys are folded down to the block size.',
    },
    {
      heading: 'The secret stays in the tab',
      body: 'Both the message and the key are handled by the Web Crypto API inside your browser and nothing is transmitted. Even so, treat a signing secret as live credentials and clear the key field when you are done.',
    },
  ],
  faq: [
    {
      q: 'What is HMAC used for?',
      a: 'HMAC proves that a message was produced by someone holding the shared secret key and has not been altered in transit. It is widely used for API request signing and webhook verification.',
    },
    {
      q: 'How is the key interpreted?',
      a: 'The key text is encoded as UTF-8 bytes and used directly as the raw HMAC key. Keys longer than the hash block size are hashed down first by the Web Crypto implementation.',
    },
    {
      q: 'Is HMAC-SHA1 still safe?',
      a: 'HMAC stays secure with SHA-1 far longer than plain SHA-1 does, and some legacy APIs still require it. Prefer HMAC-SHA256 for new systems.',
    },
    {
      q: 'Why is an empty key rejected?',
      a: 'An HMAC with an empty key is a degenerate case that is almost never what a caller intended, and most webhook libraries refuse it too. This tool raises an error asking for a shared secret rather than returning a digest that would not match anything.',
    },
    {
      q: 'What do "key bytes" and "bytes signed" mean?',
      a: 'Key bytes is the length of the UTF-8 encoding of the secret you typed, and bytes signed is the length of the UTF-8 encoding of the message. They are shown so you can see exactly what went into the computation, including any trailing spaces.',
    },
  ],
} as const;
