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
  related: ['jwt-decode', 'hmac', 'base64', 'hash'],
  status: 'stable',
};
