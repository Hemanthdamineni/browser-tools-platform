import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'jwt-decode',
  name: 'JWT Decoder',
  category: 'encoding',
  summary:
    'Decode a JSON Web Token and pretty-print its header and payload. Does not verify the signature.',
  description:
    'Split a JSON Web Token on its dots, base64url-decode the header and payload, and show each as formatted JSON. Timestamp claims (exp, iat, nbf) are spelled out as UTC dates. The signature is never checked — this tool only decodes.',
  keywords: [
    'jwt',
    'json web token',
    'jwt decoder',
    'decode jwt',
    'jws',
    'bearer token',
    'base64url',
    'claims',
    'id token',
    'access token',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'part',
      label: 'Show',
      type: 'select',
      default: 'all',
      choices: [
        { value: 'all', label: 'Header and payload' },
        { value: 'header', label: 'Header only' },
        { value: 'payload', label: 'Payload only' },
      ],
    },
  ],
  article: [
    {
      heading: 'Splitting a token into readable JSON',
      body: 'Paste a JWT and the tool splits it on its two dots, base64url-decodes the header and payload, and pretty-prints each as JSON under // header and // payload comments. NumericDate claims such as exp, iat and nbf are spelled out as UTC dates in the notes, and the stats report the alg, typ and kid taken from the header.',
    },
    {
      heading: 'Reading what a token actually claims',
      body: 'Reach for it when an API returns 401 and you need to know whether the token has expired, when you want to confirm which scopes or roles were issued, or when a front-end problem is being blamed on the wrong claim. Because it is pure decoding, you can inspect a token without holding the signing key, which never leaves the issuer.',
    },
    {
      heading: 'The Show switch',
      body: 'Header and payload is the default. Header only is useful when you just want to know how a token is signed and which key id it names; Payload only trims the output to the claims when you are pasting the result into a ticket or a chat thread.',
    },
    {
      heading: 'What it cannot tell you',
      body: "It does not verify the signature, so a decoded token is not evidence that the token is authentic — anybody can craft one containing the claims you see. A token must have exactly three segments and the header and payload must be valid JSON, or the position is rejected rather than silently padded. Treat exp as advisory too, because the clock that decides validity is the server's.",
    },
    {
      heading: 'Decoded without a network call',
      body: 'The whole operation is string work in your browser and the token is never transmitted. It is still a bearer credential, so paste one only where you would paste a password and clear the field when you are done.',
    },
  ],
  examples: [
    {
      title: 'Decode a sample token',
      input:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    },
    {
      title: 'Payload only',
      input:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      options: { part: 'payload' },
    },
    {
      title: 'Header only, to read the signing algorithm',
      input:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      options: { part: 'header' },
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
  related: ['jwt-sign', 'base64', 'url-encode', 'hex'],
  status: 'stable',
};
