import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'www-authenticate',
  name: 'WWW-Authenticate Builder & Parser',
  category: 'web',
  summary: 'Build or inspect HTTP authentication challenges for Basic and Bearer schemes.',
  description:
    'Generate WWW-Authenticate challenge values or parse one or more challenges with quoted realm, scope, and error parameters. Validates tokens and warns about insecure Basic transport and malformed values locally.',
  keywords: [
    'WWW-Authenticate',
    'Bearer challenge',
    'Basic auth challenge',
    'OAuth realm',
    '401 header',
    'auth-param parser',
    'HTTP authentication',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'parse',
      choices: [
        { value: 'parse', label: 'Parse challenges' },
        { value: 'build', label: 'Build challenge' },
      ],
    },
    {
      key: 'scheme',
      label: 'Scheme',
      type: 'select',
      default: 'Bearer',
      choices: ['Basic', 'Bearer'].map((value) => ({ value, label: value })),
    },
    { key: 'realm', label: 'Realm', type: 'text', default: 'api' },
    { key: 'scope', label: 'Bearer scope (optional)', type: 'text', default: '' },
    { key: 'error', label: 'Bearer error (optional)', type: 'text', default: '' },
  ],
  article: [
    {
      heading: 'Reading and writing a 401 challenge',
      body: 'Parse mode takes one or more WWW-Authenticate challenges — the kind that appear on a 401 response — and lists each scheme with its auth parameters, so realm, scope, error and anything else come out as separate rows. Build mode emits a challenge string for the Basic or Bearer scheme from the realm, scope and error options.',
    },
    {
      heading: 'Debugging an authentication handshake',
      body: 'Use it when an API returns 401 and you want to read the terms the server offered, when you are writing a client and need to know exactly how a server formatted its challenge, or when producing the challenge your own service will return.',
    },
    {
      heading: 'Options',
      body: 'Mode chooses parse or build. In build mode, Scheme selects Basic or Bearer, Realm supplies the quoted realm value, and the optional Bearer scope and Bearer error parameters are added when non-empty. In parse mode the pasted text is what matters and the options are ignored.',
    },
    {
      heading: 'What it validates and what it does not',
      body: 'It checks that the scheme is a valid token, that parameters are well-formed quoted or token values, that a realm is not empty, and that no parameter repeats. It never handles passwords or tokens and never makes a request. Basic credentials over plain HTTP remain a serious problem — Base64 is encoding, not encryption — and the tool says so.',
    },
    {
      heading: 'Parsed without touching the network',
      body: 'Challenges are parsed in your browser and nothing is transmitted, so a header copied from a production 401 is safe to inspect here. It keeps working with no connection.',
    },
  ],
  examples: [
    {
      title: 'Parse challenges',
      input: 'Basic realm="Members", Bearer realm="api", scope="read write"',
    },
    {
      title: 'Build a Bearer challenge',
      options: { mode: 'build', scheme: 'Bearer', realm: 'api', scope: 'read:profile' },
    },
    {
      title: 'Read a Bearer error challenge',
      input:
        'Bearer realm="api", error="invalid_token", error_description="The access token expired"',
    },
  ],
  faq: [
    {
      q: 'Does this validate credentials?',
      a: 'No. It only builds and parses challenge metadata. It never handles passwords, tokens, or network requests.',
    },
    {
      q: 'Is Basic authentication secure?',
      a: 'Basic credentials must be protected by HTTPS and appropriate server controls. Base64 is encoding, not encryption.',
    },
    {
      q: 'What is a Bearer scope?',
      a: 'It is a server-declared space-delimited scope hint for the requested authorization context. Exact meaning depends on the authorization system.',
    },
  ],
  related: ['basic-auth', 'set-cookie', 'security-headers'],
  status: 'stable',
};
