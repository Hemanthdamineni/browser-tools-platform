import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'url-parse',
  name: 'URL Parser',
  category: 'web',
  summary: 'Break a URL into protocol, host, path, query parameters and hash.',
  description:
    'Paste any URL (absolute, or relative with a base) to see every component: scheme, credentials, host, port, origin, path (raw and decoded), each query parameter and the fragment. Repeated parameter keys are listed individually.',
  keywords: [
    'url parser',
    'parse url',
    'query string',
    'query parameters',
    'url components',
    'split url',
    'url inspector',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'base',
      label: 'Base URL (for relative input)',
      type: 'text',
      default: '',
      placeholder: 'https://example.com',
      help: 'Optional base URL to resolve a relative input against.',
    },
  ],
  examples: [
    {
      title: 'Absolute URL',
      input: 'https://a:b@ex.com:8443/p/q?x=1&x=2&y=hi#frag',
    },
    { title: 'Relative URL with base', input: '/a/b', options: { base: 'https://ex.com' } },
    {
      title: 'Encoded path and repeated keys',
      input: 'https://ex.com/a%20b/c?tag=x&tag=y&q=one%2Btwo',
    },
  ],
  article: [
    {
      heading: 'Every component at once',
      body: 'A URL is broken into its scheme, username and password, host, hostname, port, origin, pathname (raw and percent-decoded) and hash, and every query parameter is listed on its own row. Repeated parameter keys are each shown, because a key like id appearing twice carries two distinct values that a naive parse would silently overwrite.',
    },
    {
      heading: 'Absolute and relative input',
      body: 'A bare absolute URL is parsed on its own. Paste a relative reference such as /a/b and the optional Base URL field resolves it against an origin, so the tool still reports a full protocol, host and path. Without a base, an absolute scheme is required and the tool says so if one is missing.',
    },
    {
      heading: 'Where a row goes missing',
      body: 'The port row disappears for the default port of a scheme, because the URL standard returns an empty port string for https://host and http://host. That is the expected, standards-compliant behaviour rather than a parsing bug, and it is why a component can be absent without the URL being invalid.',
    },
    {
      heading: 'Parsed on device',
      body: 'The URL is broken down with the browser URL parser in this page, so no address is sent to a server and nothing is logged. Even a URL that contains credentials is only ever inspected locally.',
    },
  ],
  faq: [
    {
      q: 'Why does the port row disappear for https://ex.com?',
      a: 'The URL API returns an empty port string when the URL uses the scheme’s default port (443 for https, 80 for http). That is the standards-compliant answer, not a parsing bug.',
    },
    {
      q: 'How are repeated query keys handled?',
      a: 'Each occurrence is listed separately, so tag=x&tag=y shows two rows for tag instead of collapsing them into an array. Both the raw and the percent-decoded value are available for every parameter.',
    },
    {
      q: 'Does the tool load the URL?',
      a: 'No. It parses the text you paste with the browser URL API and never opens a connection. Nothing is sent over the network, so you can inspect internal or staging URLs without a request.',
    },
  ],
  related: ['querystring', 'basic-auth', 'utm-builder', 'punycode'],
  status: 'stable',
};
