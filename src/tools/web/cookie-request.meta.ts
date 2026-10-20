import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'cookie-request',
  name: 'Cookie Request Header Analyzer',
  category: 'web',
  summary: 'Parse and inspect Cookie request-header pairs.',
  description:
    'Parse a Cookie request header into name/value pairs. Splits on semicolons, preserves quoted values (including semicolons inside), decodes percent-encoding, and flags malformed pairs, empty names, and duplicates. This complements the Set-Cookie builder tool.',
  keywords: [
    'Cookie request header',
    'parse cookies',
    'name value pairs',
    'decoded cookie',
    'duplicate cookie names',
    'split by semicolon',
    'lax-mode',
    'browser cookies',
    'request cookies',
    'http Cookie header',
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
        { value: 'analyze', label: 'Parse Cookie header' },
        { value: 'build', label: 'Build Cookie header' },
      ],
    },
    {
      key: 'pairs',
      label: 'Name=Value pairs (comma or semicolon separated)',
      type: 'text',
      default: 'session=abc123; theme=dark',
    },
  ],
  examples: [
    {
      title: 'Parse a browser request cookie line',
      input: 'Cookie: session=abc123; theme=dark; locale=en-US',
    },
    { title: 'Build from pairs', options: { mode: 'build', pairs: 'a=1; b=2' } },
  ],
  faq: [
    {
      q: 'How are cookies delimited?',
      a: 'The request-header uses semicolons between pairs and an = between name and value. Quoted values can contain semicolons.',
    },
    {
      q: 'Should I percent-decode values?',
      a: 'Values may be percent-encoded (e.g. space as %20); decoding shows the real value but encoded form is what compares for use.',
    },
    {
      q: 'Are duplicate names allowed?',
      a: 'Broken; only the last name in the HTTP header would normally survive. Servers should treat repeats as an anomaly, and proxies rarely tolerate them.',
    },
  ],
  related: ['set-cookie', 'secret-scanner', 'url-encode'],
  status: 'stable',
};
