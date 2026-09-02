import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'html-entities',
  name: 'HTML Entity Encode / Decode',
  category: 'encoding',
  summary: 'Escape text for safe insertion into HTML, or decode named and numeric entities.',
  description:
    'Convert characters like < > & " to their HTML entities so they display literally instead of being parsed as markup — or decode entities (named, decimal, and hex) back to characters.',
  keywords: ['html entities', 'escape html', 'htmlspecialchars', 'ampersand', 'unescape', 'xss'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'encode',
      choices: [
        { value: 'encode', label: 'Text → Entities' },
        { value: 'decode', label: 'Entities → Text' },
      ],
    },
    {
      key: 'level',
      label: 'What to encode',
      type: 'select',
      default: 'minimal',
      choices: [
        { value: 'minimal', label: 'Minimal (& < > " \')' },
        { value: 'non-ascii', label: 'Minimal + all non-ASCII (numeric)' },
      ],
      showWhen: { key: 'mode', value: 'encode' },
    },
  ],
  examples: [
    { title: 'Escape a tag', input: '<a href="#">Tom & Jerry</a>', options: { mode: 'encode' } },
    {
      title: 'Decode',
      input: '5 &lt; 10 &amp;&amp; 10 &gt; 5 &#8212; ok',
      options: { mode: 'decode' },
    },
  ],
  faq: [
    {
      q: 'Does decoding cover every named entity?',
      a: 'It covers the common set (about 250 names) plus all decimal (&#NN;) and hex (&#xNN;) references. Rare names fall through unchanged.',
    },
  ],
  related: ['url-encode', 'unicode-escape', 'string-escape', 'html-to-text'],
  status: 'stable',
};
