/**
 * Editorial content for the keypair-generator tool page.
 *
 * Kept out of ``keypair-generator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What this generates',
      body: 'Pick an algorithm from the panel, RSA 2048, 3072 or 4096, ECDSA on P-256 or P-384, or Ed25519, and this calls the Web Crypto generateKey to mint a brand-new pair in memory. The result table shows the algorithm, key size, a SHA-256 fingerprint of the public SPKI bytes, and both keys as PEM blocks you copy out, the private one in PKCS#8 and the public in SPKI.',
    },
    {
      heading: 'Why the sign-and-verify step is there',
      body: 'With Sign the input text on, whatever you typed is signed with the fresh private key and the signature is checked against the public key, so the exported pair is proven coherent before you use it. That catches a mistyped or truncated PEM early rather than at 2 a.m. on a production server.',
    },
    {
      heading: 'How the PEMs behave outside the browser',
      body: 'Private key PKCS#8 and public key SPKI are the plain, unencrypted forms that openssl genpkey and openssl rsa or ec write accept, so the blocks drop straight into key files or OpenSSL pipelines. No passphrase is baked in, so wrap a stored key with something like openssl pkcs8 -topk8 if you need it encrypted at rest.',
    },
    {
      heading: 'Caveats about size and safety',
      body: 'Larger RSA keys must search for ever-bigger primes and can take several seconds, so RSA-4096 feels slow rather than broken. Ed25519 is the smallest and fastest choice here. Because the key lives only in memory and clipboard history, it suits short-lived test and development keys, not long-lived production secrets you would back up on trusted hardware.',
    },
  ],
  faq: [
    {
      q: 'Are the keys stored anywhere?',
      a: 'No. Keys are generated in memory with the browser\u2019s secure random generator, shown once, and discarded when the page reloads. Copy both keys before leaving — they cannot be recovered.',
    },
    {
      q: 'Are the exported PEMs OpenSSL compatible?',
      a: 'Yes. The private key is standard PKCS#8 (no encryption) and the public key is SPKI, the formats openssl genpkey and openssl rsa/ec write. Wrap them in a password with tools like openssl pkcs8 -topk8 if you store them.',
    },
    {
      q: 'Should I generate production keys this way?',
      a: 'For anything long-lived, prefer generating keys on a trusted machine or hardware token and backing them up offline. Browser-generated keys are convenient and cryptographically random, but the private key lives only in your clipboards history.',
    },
    {
      q: 'What does sign-and-verify prove?',
      a: 'It proves the exported pair is coherent: the signature made with the private key verifies against the public key. Useful right after generating keys to catch copy/paste errors.',
    },
    {
      q: 'Why is RSA-4096 slow?',
      a: 'Finding two 2048-bit primes takes a few seconds of computation. If the page seems frozen, it is working — larger keys are safer but slower both here and on every sign/verify.',
    },
  ],
} as const;
