/**
 * Editorial content for the rsa-encrypt-decrypt tool page.
 *
 * Kept out of ``rsa-encrypt-decrypt.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the tool encrypts and returns',
      body: 'Paste an RSA key into the text box and the message into the Payload field. Encrypt mode takes plain text and returns RSA-OAEP ciphertext as base64 or hex; decrypt mode takes the ciphertext and gives back the text. Because OAEP seals one block, the output is roughly the key length \u2014 256 bytes from a 2048-bit key.',
    },
    {
      heading: 'When to reach for it',
      body: 'This seals a small secret for the holder of one specific private key: a passphrase to hand to a colleague, a licence token, or a symmetric key that will encrypt something much larger. You need only the recipient\u2019s public key, with no prior shared secret.',
    },
    {
      heading: 'Options that change the result',
      body: 'The OAEP hash must match on both sides; SHA-256 is the default, SHA-384 hardens it further, and SHA-1 exists only to interoperate with old systems. The encoding is presentational \u2014 base64 is compact, hex is easier to inspect \u2014 and decrypt reads whichever one you select.',
    },
    {
      heading: 'Keys, sizes and failure modes',
      body: 'Public keys may be SPKI or PKCS#1 and private keys PKCS#8 or PKCS#1, with PKCS#1 forms re-wrapped so Web Crypto can import them. A 2048-bit key caps the message at 214 bytes, so over-long text fails with an explicit error, as does using a private key to encrypt. Keys are handled by the browser\u2019s Web Crypto in this tab, never uploaded, logged or stored.',
    },
  ],
  faq: [
    {
      q: 'What key formats are supported?',
      a: 'Public keys as SPKI (-----BEGIN PUBLIC KEY-----) or PKCS#1 (-----BEGIN RSA PUBLIC KEY-----); private keys as PKCS#8 (-----BEGIN PRIVATE KEY-----) or PKCS#1 (-----BEGIN RSA PRIVATE KEY-----, the default output of openssl rsa). PKCS#1 keys are re-wrapped to the PKCS#8/SPKI forms Web Crypto requires.',
    },
    {
      q: 'Why is there a size limit on the message?',
      a: 'RSA-OAEP encrypts one block at a time: a 2048-bit key holds at most 214 bytes of message data (256 minus OAEP overhead), so this tool is for secrets like passphrases, keys or short notes — not large files. For bulk data, encrypt with a symmetric key and encrypt that key with RSA.',
    },
    {
      q: 'Must the OAEP hash match on both sides?',
      a: 'Yes. The hash selected here defines the OAEP padding for both encrypting and decrypting. If a ciphertext was created with a different hash, decryption fails with a padding error \u2014 try switching the hash option to what the sender used.',
    },
    {
      q: 'Is the key uploaded anywhere?',
      a: 'No. The key is parsed and used only in the browser\u2019s Web Crypto implementation. The page makes no network requests (this is enforced by the platform\u2019s privacy tests), so the private key stays on your machine.',
    },
  ],
} as const;
