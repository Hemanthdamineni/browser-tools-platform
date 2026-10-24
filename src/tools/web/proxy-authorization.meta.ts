import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'proxy-authorization',
  name: 'Proxy-Authorization Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP proxy credential values.',
  description:
    'Generate or analyze Proxy-Authorization credentials for forward proxies. Supports Basic Base64 credentials and Bearer tokens, validates syntax and control characters, and highlights TLS and secret-handling risks locally.',
  keywords: [
    'Proxy-Authorization',
    '407 proxy credentials',
    'forward proxy auth',
    'Basic proxy credentials',
    'Bearer proxy token',
    'proxy header',
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
        { value: 'analyze', label: 'Analyze credentials' },
        { value: 'build', label: 'Build credentials' },
      ],
    },
    {
      key: 'scheme',
      label: 'Scheme',
      type: 'select',
      default: 'Basic',
      choices: [
        { value: 'Basic', label: 'Basic' },
        { value: 'Bearer', label: 'Bearer' },
      ],
    },
    { key: 'username', label: 'Username', type: 'text', default: '' },
    { key: 'password', label: 'Password', type: 'text', default: '' },
    { key: 'token', label: 'Bearer token', type: 'text', default: '' },
  ],
  examples: [
    { title: 'Analyze a proxy credential', input: 'Basic dXNlcjpwYXNz' },
    {
      title: 'Build a Bearer proxy credential',
      options: { mode: 'build', scheme: 'Bearer', token: 'proxy-token' },
    },
    {
      title: 'Build Basic credentials from a user name',
      options: { mode: 'build', scheme: 'Basic', username: 'user', password: 'pass' },
    },
  ],
  faq: [
    {
      q: 'Is Proxy-Authorization the same as Authorization?',
      a: 'No. Proxy-Authorization supplies credentials to a forward proxy, while Authorization supplies credentials to the origin server.',
    },
    {
      q: 'Is Basic encoding encryption?',
      a: 'No. Base64 is reversible encoding. Use TLS and avoid logging or sharing generated credentials.',
    },
    {
      q: 'Does this contact a proxy?',
      a: 'No. The tool only formats and validates values locally and never sends credentials over the network.',
    },
  ],
  article: [
    {
      heading: 'Building and reading proxy credentials',
      body: 'Analyze mode parses a Proxy-Authorization value into its scheme and credential and reports whether the syntax is usable. Build mode takes a user name and password for Basic, or a token for Bearer, and returns the finished header line, such as Basic dXNlcjpwYXNz, ready to paste into a client or a test.',
    },
    {
      heading: 'Testing an authenticated forward proxy',
      body: 'Use it when you need credentials for a forward proxy during a debugging session: build the Basic value from the account you were given, or decode a value you captured to confirm which account it carries. It also confirms that a Bearer token your proxy expects is shaped correctly before you wire it into a request.',
    },
    {
      heading: 'The options that shape the value',
      body: 'The scheme choice switches between Basic and Bearer. Basic uses the user name and password fields, concatenated with a colon and Base64 encoded; Bearer uses the token field verbatim. Fed through the build option, the credential is validated with the same checks analyze mode applies, so a value it returns is well formed.',
    },
    {
      heading: 'What it will not protect',
      body: 'Base64 is reversible encoding, not encryption, so a Basic value can be decoded by anyone who sees it. Only Basic and Bearer are handled, the credential must be padded Base64 for Basic, and values containing line breaks or stray whitespace are rejected. Always send proxy credentials over TLS and keep them out of logs.',
    },
    {
      heading: 'Credentials never leave the page',
      body: 'The encoding and checks run entirely in your browser, and no proxy is contacted. Nothing is transmitted, so a real proxy secret you paste for validation stays on your machine and the tool still works offline.',
    },
  ],
  related: ['proxy-authenticate', 'basic-auth', 'secret-scanner'],
  status: 'stable',
};
