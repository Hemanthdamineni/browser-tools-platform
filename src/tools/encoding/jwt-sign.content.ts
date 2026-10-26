/**
 * Editorial content for the jwt-sign tool page.
 *
 * Kept out of ``jwt-sign.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Signing and verifying in one place',
      body: 'In sign mode you paste a JSON object of claims and get a compact JWS: a base64url header, a base64url payload and an HMAC signature joined by dots, plus the algorithm, byte sizes and token length. In verify mode you paste a finished token, the tool recomputes the signature and answers Signature VALID or INVALID, reporting the exp and nbf timeline.',
    },
    {
      heading: 'A realistic test loop',
      body: 'It fits local API work: mint a short-lived HS256 token to exercise a bearer-token endpoint you are building, then paste a token your issuer produced to confirm it verifies with the shared secret you hold.',
    },
    {
      heading: 'What each option alters',
      body: 'Mode switches between signing and checking. Signing algorithm chooses HS256, HS384 or HS512. The secret is the HMAC key and is never stored. The typ toggle adds "typ":"JWT" to the header, add-issued-at stamps iat with the current time, and Expires in adds an exp claim a set number of minutes after iat (or now); 0 adds none.',
    },
    {
      heading: 'Where it stops',
      body: 'Only the HMAC family is supported: RS, ES and PS tokens, which need a private key, cannot be signed here and cannot be verified either. Verification proves the signature matches the secret you supplied and checks exp and nbf, but it cannot prove that secret is genuinely the issuer’s. A header using a crit extension is flagged.',
    },
    {
      heading: 'The secret stays in the tab',
      body: 'Signing runs through the Web Crypto API inside this page, so the secret and the claims are used locally, never uploaded and never logged. You can confirm it in DevTools → Network, and the page works with no connection.',
    },
  ],
  faq: [
    {
      q: 'Does my secret leave my browser?',
      a: 'No. The secret is used as the HMAC key by the Web Crypto API inside this tab. Nothing is uploaded and no request is made — you can confirm in DevTools → Network.',
    },
    {
      q: 'Which algorithms are supported?',
      a: 'HMAC algorithms HS256, HS384 and HS512, which share a symmetric secret and are by far the most common for self-issued tokens. RS/ES/PS tokens need a private key and are not signed here; tokens signed with them cannot be verified either.',
    },
    {
      q: 'Does verifying prove the token is trustworthy?',
      a: 'It proves the signature matches for the secret you supply and reports whether the exp/nbf claims are in range. It cannot prove the secret itself is the issuer’s — make sure you paste the real secret.',
    },
  ],
} as const;
