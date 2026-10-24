import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'proxy-authenticate',
  name: 'Proxy-Authenticate Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP proxy authentication challenges.',
  description:
    'Generate or analyze Proxy-Authenticate challenges for forward proxies. Supports Basic and Bearer realms plus Bearer scope and error parameters, validates quoted values, and distinguishes proxy authentication from origin authentication.',
  keywords: [
    'Proxy-Authenticate',
    '407 Proxy Authentication Required',
    'forward proxy',
    'Basic proxy auth',
    'Bearer proxy auth',
    'proxy challenge',
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
        { value: 'analyze', label: 'Analyze challenge' },
        { value: 'build', label: 'Build challenge' },
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
    { key: 'realm', label: 'Realm', type: 'text', default: 'proxy' },
    { key: 'scope', label: 'Bearer scope (optional)', type: 'text', default: '' },
  ],
  article: [
    {
      heading: 'Build a challenge, or decode one',
      body: 'Build mode emits a Proxy-Authenticate header from the scheme and realm you choose, adding an optional Bearer scope, with values quoted and validated so the result is syntactically sound. Analyze mode splits pasted text into individual challenges — respecting commas that sit inside quotes — and lays out each scheme and its parameters as table rows.',
    },
    {
      heading: 'Why the realm is not optional in practice',
      body: 'A challenge without a realm is incomplete, because the realm is what tells a client which set of proxy credentials to send, so the analyzer flags its absence. It also reports parameters it does not recognise rather than quietly dropping them, which matters when a proxy offers something you have not seen before.',
    },
    {
      heading: 'Proxy auth is not origin auth',
      body: 'This header belongs in a 407 Proxy Authentication Required response from a forward proxy and applies only to the next hop. An origin server challenging the client uses WWW-Authenticate with 401 instead; confusing the two makes a browser collect credentials for the wrong party.',
    },
    {
      heading: 'Basic is encoding, not protection',
      body: 'Basic proxy credentials are merely Base64-encoded, so they look scrambled but reverse trivially — keep the connection on TLS and prefer a stronger scheme when the proxy supports one. Both the builder and the analyzer run locally, so the realms and scope strings you type never leave the page.',
    },
  ],
  examples: [
    { title: 'Analyze a proxy challenge', input: 'Basic realm="corp-proxy"' },
    {
      title: 'Build a Bearer proxy challenge',
      options: { mode: 'build', scheme: 'Bearer', realm: 'edge-proxy', scope: 'connect' },
    },
    {
      title: 'Build a Basic challenge',
      options: { mode: 'build', scheme: 'Basic', realm: 'corp-proxy' },
    },
  ],
  faq: [
    {
      q: 'When is Proxy-Authenticate used?',
      a: 'A forward proxy can send it with 407 Proxy Authentication Required to request proxy credentials from the client.',
    },
    {
      q: 'Is it the same as WWW-Authenticate?',
      a: 'No. Proxy-Authenticate applies to the next proxy, while WWW-Authenticate challenges the origin server.',
    },
    {
      q: 'Is Basic safe over HTTP?',
      a: 'Basic credentials are only Base64-encoded. Use TLS and prefer stronger schemes where available.',
    },
  ],
  related: ['www-authenticate', 'basic-auth', 'security-headers'],
  status: 'stable',
};
