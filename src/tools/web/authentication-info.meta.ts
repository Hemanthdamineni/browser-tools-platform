import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'authentication-info',
  name: 'Authentication-Info Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Authentication-Info parameters.',
  description:
    'Generate or analyze Authentication-Info response parameters used by Digest authentication. Validates tokens, quoted values, nextnonce, rspauth, and nonce-count fields locally without handling credentials or making requests.',
  keywords: [
    'Authentication-Info',
    'Digest authentication',
    'nextnonce',
    'rspauth',
    'nonce-count',
    'HTTP auth response',
    'authentication parameters',
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
        { value: 'analyze', label: 'Analyze parameters' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'parameter',
      label: 'Parameter',
      type: 'select',
      default: 'nextnonce',
      choices: [
        { value: 'nextnonce', label: 'nextnonce' },
        { value: 'rspauth', label: 'rspauth' },
        { value: 'nc', label: 'nc' },
      ],
    },
    { key: 'value', label: 'Value', type: 'text', default: '"nonce-value"' },
  ],
  examples: [
    {
      title: 'Analyze Digest response info',
      input: 'nextnonce="server-nonce", rspauth="abc123", nc=00000001',
    },
    {
      title: 'Build a nextnonce field',
      options: { mode: 'build', parameter: 'nextnonce', value: '"server-nonce"' },
    },
    {
      title: 'Check a nonce count value',
      input: 'nc=0000002a',
    },
  ],
  article: [
    {
      heading: 'Building one parameter',
      body: 'Build mode turns a chosen parameter and value into the field a Digest response would carry. nextnonce and rspauth are wrapped in double quotes with embedded quotes and backslashes escaped, while nc is written bare and checked against exactly eight hexadecimal digits.',
    },
    {
      heading: 'Reading a pasted parameter list',
      body: 'Analyze mode splits a comma-separated Authentication-Info value, keeping quoted strings intact, and lists each parameter with its decoded value and a status. It flags invalid tokens, duplicates, unknown names, an empty nextnonce or rspauth, and an nc that is not eight hex digits.',
    },
    {
      heading: 'A typical use',
      body: 'Reach for it when a Digest response looks wrong and you want to confirm the nextnonce or nc before wiring the header into a client, instead of splitting the value by hand.',
    },
    {
      heading: 'What it does not prove',
      body: 'Only syntax is checked. rspauth is a response digest and cannot be verified without the matching request context and shared secret, so a clean status is not proof that the response is authentic.',
    },
    {
      heading: 'Handled locally',
      body: 'Parsing and building happen inside the page. No credential or nonce is uploaded, and the tool makes no network request.',
    },
  ],
  faq: [
    {
      q: 'Does Authentication-Info contain credentials?',
      a: 'It carries response-side Digest authentication parameters, not the user password. Still avoid pasting live production nonces or tokens into shared environments.',
    },
    {
      q: 'What is nextnonce?',
      a: 'It lets a server provide a nonce for a subsequent authenticated request, reducing the need for another challenge.',
    },
    {
      q: 'Does this verify rspauth?',
      a: 'No. It validates field syntax only and cannot verify a response digest without the request context and secret.',
    },
  ],
  related: ['www-authenticate', 'basic-auth', 'secret-scanner'],
  status: 'stable',
};
