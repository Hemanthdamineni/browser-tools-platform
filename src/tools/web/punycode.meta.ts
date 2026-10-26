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
  related: ['url-parse', 'url-encode', 'unicode-normalize'],
  status: 'stable',
};
