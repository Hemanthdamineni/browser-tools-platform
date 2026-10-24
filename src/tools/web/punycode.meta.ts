import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'punycode',
  name: 'Punycode / IDN Converter',
  category: 'web',
  summary: 'Convert internationalised domain names to ASCII (xn--) and back, per RFC 3492.',
  description:
    'Turn Unicode domain labels like münchen.de into their ASCII-compatible xn-- form for DNS, or decode xn-- labels back to Unicode. Implemented in pure JavaScript following RFC 3492.',
  keywords: [
    'punycode',
    'idn',
    'internationalized domain name',
    'xn--',
    'rfc 3492',
    'idn converter',
    'unicode domain',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'to-ascii',
      choices: [
        { value: 'to-ascii', label: 'Unicode → ASCII (xn--)' },
        { value: 'to-unicode', label: 'ASCII (xn--) → Unicode' },
      ],
    },
  ],
  examples: [
    { title: 'To ASCII', input: 'münchen.de' },
    { title: 'To Unicode', input: 'xn--mnchen-3ya.de', options: { mode: 'to-unicode' } },
    { title: 'A Cyrillic domain', input: 'пример.рф' },
  ],
  faq: [
    {
      q: 'Is every label validated for length?',
      a: 'No — this tool performs the RFC 3492 code conversion only. DNS label length limits (63 bytes) and whole-domain validation are the responsibility of your registrar or DNS tooling.',
    },
    {
      q: 'Why do some labels keep their Unicode form?',
      a: 'Any label that is already plain ASCII is passed through untouched, so example.com stays as it is next to the encoded xn-- label. In the other direction, only labels that begin with xn-- are decoded, and an invalid encoded label raises an error instead of guessing.',
    },
    {
      q: 'Does it apply IDNA mapping?',
      a: 'No. It converts code points with the RFC 3492 algorithm but does not perform the IDNA case folding, NFC normalisation or script-mixing checks that browsers run before a lookup. Treat the result as the raw Punycode form, not as a validated registrable domain.',
    },
  ],
article: [
    {
      heading: 'What the Punycode converter does',
      body: 'Type a domain and the tool converts it in the direction you choose: Unicode labels such as münchen become the ASCII-compatible form münchen with an xn-- prefix for DNS, and xn-- labels decode back to their Unicode form. Labels that are already plain ASCII pass through unchanged, so mixed domains work.',
    },
    {
      heading: 'Checking a Unicode domain before you register it',
      body: 'Use it when you are considering an internationalised domain and want to see the exact ASCII string a registrar or DNS provider will store, or when you receive an xn-- link and want to know which characters it really spells before you click. Seeing the decoded form also exposes lookalike characters used for homograph tricks.',
    },
    {
      heading: 'Choosing the direction',
      body: 'The Direction option switches between Unicode to ASCII and ASCII to Unicode. In the first direction each non-ASCII label is encoded and prefixed; in the second, only labels starting with xn-- are decoded, and anything else is left as written, which keeps the round trip predictable.',
    },
    {
      heading: 'What it will not validate',
      body: 'This is the RFC 3492 code conversion and nothing more. Label length limits, the IDNA case folding and normalisation steps, and script-mixing or spoofing checks are not applied, so the output is the raw Punycode form rather than a validated registrable domain. An invalid encoded label raises a clear error.',
    },
    {
      heading: 'Conversion stays on your device',
      body: 'The algorithm runs in pure JavaScript inside the page, with no DNS lookup and no network request. The domains you type are never transmitted, and the converter works offline.',
    },
  ],
  related: ['url-parse', 'url-encode', 'unicode-normalize'],
  status: 'stable',
};
