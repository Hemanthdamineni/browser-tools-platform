/**
 * Editorial content for the jwt-decode tool page.
 *
 * Kept out of ``jwt-decode.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Splitting a token into readable JSON',
      body: 'Paste a JWT and the tool splits it on its two dots, base64url-decodes the header and payload, and pretty-prints each as JSON. NumericDate claims such as exp, iat and nbf are spelled out as UTC dates in the notes, and the stats report the alg, typ and kid from the header.',
    },
    {
      heading: 'Reading what a token actually claims',
      body: 'Reach for it when an API returns 401 and you need to know whether the token has expired, or when you want to confirm which scopes or roles were issued. Because it is pure decoding, you can inspect a token without holding the signing key, which never leaves the issuer.',
    },
    {
      heading: 'The Show switch',
      body: 'Header and payload is the default. Header only is useful when you just want to know how a token is signed and which key id it names; Payload only trims the output to the claims when you are pasting the result into a ticket or a chat thread.',
    },
    {
      heading: 'What it cannot tell you',
      body: "It does not verify the signature, so a decoded token is not evidence that the token is authentic — anybody can craft one containing the claims you see. A token must have exactly three segments and valid JSON in its header and payload. Treat exp as advisory, because the clock that decides validity is the server's.",
    },
    {
      heading: 'Decoded without a network call',
      body: 'The whole operation is string work in your browser and the token is never transmitted. It is still a bearer credential, so paste one only where you would paste a password and clear the field when you are done.',
    },
  ],
  faq: [
    {
      q: 'Does this verify the signature?',
      a: 'No. It only decodes the header and payload. It cannot tell you whether the token is authentic or was tampered with — that requires the signing key, which never leaves the issuer.',
    },
    {
      q: 'Is my token sent anywhere?',
      a: 'No. Decoding is pure string work that runs in your browser tab. Nothing is uploaded. Still, treat tokens as secrets and clear the field when you are done.',
    },
    {
      q: 'What do exp, iat and nbf mean?',
      a: 'They are NumericDate claims — seconds since 1970-01-01 UTC. exp is when the token expires, iat when it was issued, nbf the earliest time it is valid. This tool prints each as a readable UTC date.',
    },
  ],
} as const;
