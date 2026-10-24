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
  article: [
    {
      heading: 'One header at a time, in either direction',
      body: 'Analyze takes one Set-Cookie header per line, splits each on semicolons and returns a row per cookie: name, a "Looks secure" or "Review" verdict, the value and the issues found, so a batch pasted from a proxy log reads at a glance. Build takes a name, value and attribute fields and prints a single joined line such as "session=opaque-token; Path=/; SameSite=Lax; Secure; HttpOnly".',
    },
    {
      heading: 'When to build instead of typing the header by hand',
      body: 'Build mode is the dependable way to emit a cookie for an internal API, a webhook callback or a redirect that needs an exact SameSite value, and it validates the name, value, path and domain while refusing a value containing a semicolon or line break.',
    },
    {
      heading: 'The flags the analyzer cares about',
      body: 'A cookie is only reported clean when it carries Secure, HttpOnly, a SameSite of Strict, Lax or None, and a Path. SameSite=None additionally requires Secure, a leading-dot Domain is flagged as obsolete syntax, and a Max-Age that is not a non-negative whole number is called out.',
    },
    {
      heading: 'Where the tool stops and your application begins',
      body: 'No local check can see your HTTPS setup, your login flow, or whether the cookie value is a guessable token, so the verdicts are a checklist rather than a promise. Build mode also refuses SameSite=None without Secure, which matches the dominant browser rule but means you cannot generate that line here for a client you control.',
    },
    {
      heading: 'Nothing is sent, stored or read from your browser',
      body: 'Both directions are pure text work in this tab: a cookie copied from a production response, or one being designed for staging, never leaves the page, and the tool never touches your own cookie jar.',
    },
  ],
  faq: [
    {
      q: 'Does this handle browser cookies?',
      a: 'No. It only formats and analyzes header text locally. It does not read your browser cookie jar, set cookies, or make network requests.',
    },
    {
      q: 'Why are Secure and HttpOnly recommended?',
      a: 'Secure limits transmission to HTTPS, while HttpOnly prevents JavaScript from reading the cookie. Whether they are appropriate depends on the application and deployment.',
    },
    {
      q: 'Is SameSite=None always valid?',
      a: 'Modern browsers generally require SameSite=None cookies to also include Secure. The analyzer flags that combination when Secure is absent.',
    },
  ],
  related: ['security-headers', 'url-encode', 'basic-auth'],
  status: 'stable',
};
