/**
 * Editorial content for the csr-decoder tool page.
 *
 * Kept out of ``csr-decoder.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What gets decoded from the request',
      body: 'The request is parsed as a real PKCS#10 structure, so you see the subject fields in the exact order they were encoded, every requested subjectAltName with its DNS, IP, email, URI or other type, the public key algorithm and its curve or bit length, and each requested extension with its critical flag. The output lists exactly what a certificate authority would read from the bytes.',
    },
    {
      heading: 'The signature is actually checked',
      body: 'A signing request is self-signed with the private key that matches the public key inside it. The tool re-verifies that signature using the WebCrypto API with the key already embedded in the request, so you get a real integrity result instead of a guess. A passing check means the request is unmodified and the holder of the private key produced it.',
    },
    {
      heading: 'Findings catch problems before you submit',
      body: 'The findings view looks for the mistakes that cause a CA to reject or question a request: a subject that carries no common name or SANs, a signature that fails to verify, extensions that conflict, or an odd key size. It is advisory and cannot predict every CA policy.',
    },
    {
      heading: 'Everything stays in this tab',
      body: 'The DER is parsed and the signature verified entirely in the browser with the public key already present in the request. No network request is made, nothing is logged, and the pasted text never leaves your device.',
    },
  ],
  faq: [
    {
      q: 'What does the signature check prove?',
      a: 'A PKCS#10 request is signed with the private key that matches the public key inside it. If the signature verifies, the request is intact and whoever sent it holds that private key. It says nothing about whether the requester is entitled to the names they asked for.',
    },
    {
      q: 'Why is a certificate rejected with a hint?',
      a: 'Certificates and requests are different structures. If you paste a certificate the tool says so rather than showing nonsense, and the X.509 Certificate Inspector in this collection decodes that instead.',
    },
    {
      q: 'Which key types are understood?',
      a: 'RSA (with the modulus bit length), EC keys with a named curve such as prime256v1 or secp384r1, and Ed25519 and Ed448. Unknown algorithms are still listed by OID so you can look them up.',
    },
    {
      q: 'Is the request sent anywhere?',
      a: 'No. The DER is parsed in this page and the signature is checked with the browser WebCrypto API using the public key already inside the request, so nothing leaves your device.',
    },
  ],
} as const;
