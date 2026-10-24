import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'jwt-sign',
  name: 'JWT Signer',
  category: 'encoding',
  summary: 'Create and sign JSON Web Tokens with HMAC, or verify an existing token’s signature.',
  description:
    'Build a signed JSON Web Token (JWS) from a JSON payload and a secret, or paste a token to recompute its HMAC signature and confirm it is authentic and unexpired. All signing runs with the Web Crypto API inside your browser.',
  keywords: [
    'jwt',
    'json web token',
    'jwt signer',
    'sign jwt',
    'create jwt',
    'generate jwt',
    'jwt encoder',
    'verify jwt',
    'hs256',
    'hmac token',
    'bearer token',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'sign',
      choices: [
        { value: 'sign', label: 'Sign — payload to token' },
        { value: 'verify', label: 'Verify — check a token' },
      ],
    },
    {
      key: 'algorithm',
      label: 'Signing algorithm',
      type: 'select',
      default: 'HS256',
      showWhen: { key: 'mode', value: 'sign' },
      choices: [
        { value: 'HS256', label: 'HS256 — HMAC-SHA256' },
        { value: 'HS384', label: 'HS384 — HMAC-SHA384' },
        { value: 'HS512', label: 'HS512 — HMAC-SHA512' },
      ],
    },
    {
      key: 'secret',
      label: 'Signing secret',
      type: 'text',
      default: '',
      placeholder: 'shared secret / HMAC key',
      help: 'The HMAC key the token is signed with. It is used, never stored, and never leaves this tab.',
    },
    {
      key: 'typ',
      label: 'Include "typ": "JWT" in the header',
      type: 'boolean',
      default: true,
      showWhen: { key: 'mode', value: 'sign' },
    },
    {
      key: 'addIat',
      label: 'Add an issued-at (iat) claim',
      type: 'boolean',
      default: false,
      showWhen: { key: 'mode', value: 'sign' },
    },
    {
      key: 'expiresIn',
      label: 'Expires in (minutes)',
      type: 'number',
      default: 0,
      min: 0,
      step: 1,
      showWhen: { key: 'mode', value: 'sign' },
      help: '0 adds no exp claim. Otherwise an exp claim is added based on iat (or now).',
    },
  ],
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
  examples: [
    {
      title: 'Sign a sample payload',
      input: '{"sub":"1234567890","name":"John Doe","iat":1516239022}',
      options: { secret: 'your-256-bit-secret' },
    },
    {
      title: 'Add an expiry',
      input: '{"sub":"1234567890","name":"John Doe"}',
      options: { secret: 's3cret', addIat: true, expiresIn: 60 },
    },
    {
      title: 'Verify a token',
      input:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      options: { mode: 'verify', secret: 'your-256-bit-secret' },
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
  related: ['jwt-decode', 'hmac', 'base64', 'hash'],
  status: 'stable',
};
