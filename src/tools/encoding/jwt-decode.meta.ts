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
  related: ['jwt-sign', 'base64', 'url-encode', 'hex'],
  status: 'stable',
};
