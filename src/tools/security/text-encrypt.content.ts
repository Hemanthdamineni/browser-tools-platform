/**
 * Editorial content for the text-encrypt tool page.
 *
 * Kept out of ``text-encrypt.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the two modes do',
      body: 'Encrypt mode takes plain text and a passphrase and emits a single opaque token you can paste anywhere; decrypt mode takes such a token and the same passphrase and returns the text. The passphrase is required both ways and is never stored, so the token and the password have to travel separately \u2014 sending both in one message defeats the point.',
    },
    {
      heading: 'The construction behind the token',
      body: 'A fresh 16-byte salt is generated for every encryption and the passphrase is stretched into a 256-bit key with PBKDF2-SHA256 at 600,000 iterations, deliberately slow to make guessing expensive. The text is sealed with AES-256-GCM using a random 12-byte IV, and the token is the prefix TBenc1. followed by base64 of salt, IV and ciphertext with its authentication tag.',
    },
    {
      heading: 'Why tampering is detected',
      body: 'GCM is authenticated encryption: the tag is checked before any plaintext is released. A single altered character, or the wrong passphrase, fails that check and the tool reports "Wrong password or corrupted data." without revealing which it was, since distinguishing them would help an attacker. A token missing the TBenc1. prefix is refused immediately.',
    },
    {
      heading: 'Limits, caveats and privacy',
      body: 'There is no key escrow, recovery hint or server, so a forgotten passphrase means the ciphertext is unreadable forever, by design. Strength rests on the passphrase you choose and the device you type it on, so treat this as a convenient everyday tool rather than a replacement for audited software. The passphrase, plaintext and token all stay in this tab, with no upload and no local storage.',
    },
  ],
  faq: [
    {
      q: 'What exactly does the encryption do?',
      a: 'A random 16-byte salt is generated and your passphrase is stretched into a 256-bit key with PBKDF2-SHA256 at 600,000 iterations. The text is then encrypted with AES-256-GCM using a random 12-byte IV. The output is "TBenc1." followed by base64 of salt (16 bytes) + IV (12 bytes) + ciphertext with its authentication tag.',
    },
    {
      q: 'I forgot the password — can you recover my text?',
      a: 'No. There is no backup, no recovery hint and no server. A lost passphrase means the ciphertext is permanently unreadable, by design.',
    },
    {
      q: 'Is this safe for highly sensitive data?',
      a: 'The primitives are standard and run locally via the Web Crypto API, but security still depends on a strong, unique passphrase and a trusted device. For high-stakes secrets use dedicated, audited software.',
    },
  ],
} as const;
