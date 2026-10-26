import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'set-cookie',
  name: 'Set-Cookie Builder & Analyzer',
  category: 'web',
  summary: 'Build or review Set-Cookie headers and their security attributes locally.',
  description:
    'Generate a Set-Cookie response header from cookie attributes, or analyze one or more pasted Set-Cookie lines for Secure, HttpOnly, SameSite, Domain, Path, and expiry settings. This tool never stores or transmits cookies.',
  keywords: [
    'set-cookie builder',
    'cookie header generator',
    'cookie security analyzer',
    'SameSite cookie',
    'HttpOnly Secure cookie',
    'parse set-cookie',
    'cookie attributes',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'analyze',
      choices: [
        { value: 'analyze', label: 'Analyze Set-Cookie lines' },
        { value: 'build', label: 'Build a Set-Cookie header' },
      ],
    },
    { key: 'name', label: 'Cookie name', type: 'text', default: 'session' },
    { key: 'value', label: 'Cookie value', type: 'text', default: '' },
    { key: 'path', label: 'Path', type: 'text', default: '/' },
    { key: 'domain', label: 'Domain (optional)', type: 'text', default: '' },
    {
      key: 'sameSite',
      label: 'SameSite',
      type: 'select',
      default: 'Lax',
      choices: ['Strict', 'Lax', 'None'].map((value) => ({ value, label: value })),
    },
    { key: 'secure', label: 'Secure', type: 'boolean', default: true },
    { key: 'httpOnly', label: 'HttpOnly', type: 'boolean', default: true },
    { key: 'maxAge', label: 'Max-Age seconds (optional)', type: 'number', default: 0, min: 0 },
  ],
  examples: [
    { title: 'Analyze a cookie', input: 'session=abc123; Path=/; Secure; HttpOnly; SameSite=Lax' },
    {
      title: 'Build a secure session cookie',
      options: {
        mode: 'build',
        name: 'session',
        value: 'opaque-token',
        sameSite: 'Lax',
        secure: true,
        httpOnly: true,
      },
    },
    {
      title: 'Analyze a cookie missing its security flags',
      input: 'id=1234; Path=/; Domain=.example.com',
    },
  ],
  related: ['security-headers', 'url-encode', 'basic-auth'],
  status: 'stable',
};
