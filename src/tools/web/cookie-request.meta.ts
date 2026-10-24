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
    {
      title: 'Spot duplicate cookie names',
      input: 'Cookie: sid=old; theme=dark; sid=new',
    },
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
  article: [
    {
      heading: 'Parse a request header into pairs',
      body: 'Paste a Cookie request header, with or without the "Cookie:" prefix, and the tool splits it on semicolons into name/value pairs, showing each name, its value and a status of Valid, Duplicate or Invalid. Values are percent-decoded for display, so %20 becomes a space, and the stats report how many pairs, how many duplicates and whether any percent-encoding was present. An empty input produces an empty table with a nudge to paste something rather than an error.',
    },
    {
      heading: 'The semicolon rule and quoted values',
      body: 'The delimiter is the semicolon, but the splitter honours double-quoted strings, so a value like theme="a;b" is kept whole rather than broken in two, which matters because some cookies deliberately carry semicolons or spaces inside quotes. A pair with no equals sign gets an empty name and is marked Invalid with a message saying a cookie pair needs the name=value form. Decoding is a best-effort percent-decode: each %XX becomes the byte it names, while literal text that was never encoded is left alone.',
    },
    {
      heading: 'Build mode goes the other way',
      body: 'The build option takes name=value pairs separated by commas or semicolons and reassembles them into a single Cookie header joined with "; ". It flags an empty name, detects duplicate names case-insensitively, and reports how many pairs were built alongside how many issues were found, so a pair typed without an equals sign produces a warning instead of a silently malformed header.',
    },
    {
      heading: 'Why duplicates matter',
      body: 'A Cookie header naming the same cookie twice is broken in practice: a server or proxy normally keeps only the last occurrence, and many intermediaries reject the header outright. The analyzer flags every repeat and says so in its notes, which is how you catch a template bug or a client that double-sends a session cookie before it turns into a confusing sign-out.',
    },
    {
      heading: 'Local and unread',
      body: 'Parsing and building run entirely in this tab. Cookies often carry session tokens, so it matters that nothing here is uploaded, logged or sent to any server, and the page makes no request while you work.',
    },
  ],
  related: ['set-cookie', 'secret-scanner', 'url-encode'],
  status: 'stable',
};
