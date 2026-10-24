import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'url-encode',
  name: 'URL Encode / Decode',
  category: 'encoding',
  summary: 'Percent-encode or decode text for use in URLs — component or whole-URL mode.',
  description:
    'Escape text so it is safe inside a URL, or turn percent-escapes back into readable text. "Component" escapes everything reserved; "whole URL" keeps :/?#[]@ intact.',
  keywords: [
    'url encode',
    'percent encode',
    'uri',
    'encodeURIComponent',
    'decodeURIComponent',
    'escape',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'encode',
      choices: [
        { value: 'encode', label: 'Text → URL-encoded' },
        { value: 'decode', label: 'URL-encoded → Text' },
      ],
    },
    {
      key: 'scope',
      label: 'Scope',
      type: 'select',
      default: 'component',
      choices: [
        { value: 'component', label: 'Component (encode everything reserved)' },
        { value: 'full', label: 'Whole URL (keep : / ? # [ ] @)' },
      ],
    },
    {
      key: 'plusSpace',
      label: 'Treat + as space (decode)',
      type: 'boolean',
      default: false,
      help: 'For application/x-www-form-urlencoded data.',
      showWhen: { key: 'mode', value: 'decode' },
    },
  ],
  examples: [
    { title: 'Encode a query value', input: 'name=John Doe & Co.', options: { mode: 'encode' } },
    { title: 'Decode', input: 'caf%C3%A9%20%26%20cr%C3%A8me', options: { mode: 'decode' } },
    {
      title: 'Encode a full URL without breaking it',
      input: 'https://example.com/search?q=blue shoes&page=2',
      options: { mode: 'encode', scope: 'full' },
    },
    {
      title: 'Decode a form-encoded body',
      input: 'first_name=John+Doe&city=New+York',
      options: { mode: 'decode', plusSpace: true },
    },
  ],
  article: [
    {
      heading: 'Two scopes for two jobs',
      body: 'In component scope the whole string is percent-encoded, so every reserved character — colon, slash, question mark, hash, brackets and at-sign — is escaped along with spaces and anything non-ASCII. In whole-URL scope those structural characters stay intact and only genuinely unsafe bytes are escaped.',
    },
    {
      heading: 'Encoding versus decoding',
      body: 'Encoding escapes bytes that are not URL-safe; decoding turns percent escapes back into readable text. Decoding is strict: a lone % or an incomplete %XX sequence raises an error rather than passing bad data through, because malformed escapes are a common cause of a rejected request.',
    },
    {
      heading: 'The plus-as-space switch',
      body: 'Form bodies sent as application/x-www-form-urlencoded use + to mean a space, unlike a URL path where + is a literal plus. When decoding such a body, turn on “Treat + as space” so first_name=John+Doe becomes John Doe; leave it off when decoding a path segment where a + must survive.',
    },
    {
      heading: 'A concrete case',
      body: 'A search box submits "blue shoes & sandals" and the request fails with a 400 because of the raw space and ampersand. Paste the value in component mode to get the escaped query parameter, or the whole URL in full mode to escape only the unsafe parts.',
    },
    {
      heading: 'Handled in your browser',
      body: 'Both encodeURI and decodeURI run locally through the platform API — nothing is sent to a server, which matters when the URL carries a signed token, an internal hostname or a session id. The tool works offline.',
    },
  ],
  faq: [
    {
      q: 'Component vs whole URL?',
      a: 'Use "component" for a single query-string value or path segment. Use "whole URL" when the input is already a full URL and you only want to fix unsafe characters without breaking the structure.',
    },
    {
      q: 'Why did decoding fail with "Malformed percent-encoding"?',
      a: 'A lone % or a truncated escape such as %2 at the end of the string is not a valid sequence. Decoding refuses to guess, because passing the bad bytes through usually produces a worse failure further down the stack.',
    },
    {
      q: 'Does it handle non-ASCII text?',
      a: 'Yes. Text is encoded as UTF-8 bytes and each byte that is not URL-safe is percent-escaped, so café becomes caf%C3%A9 and decode returns the original text.',
    },
  ],
  related: ['base64', 'html-entities', 'querystring', 'url-parse'],
  status: 'stable',
};
