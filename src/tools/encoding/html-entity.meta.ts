import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'html-entity',
  name: 'HTML Entity Converter',
  category: 'encoding',
  summary:
    'Encode text to HTML entities (safe for &<>) and decode &amp;, &eacute;, &#123; back to text.',
  description:
    'Two-way HTML entity conversion. Encode: turn & < > " ä into &amp; &lt; &gt; &quot; &auml; so text is safe to drop into HTML without breaking markup or enabling script injection. Decode: turn &lt;b&gt;, &eacute;, &copy;, &#169; and named entities back into real characters. Runs entirely on your device.',
  keywords: [
    'html entity encode',
    'html entity decode',
    'escape html',
    'html special characters',
    'entity to unicode',
    'xss-safe html encode',
    'html entity converter',
    'decode html entities',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      choices: [
        { value: 'auto', label: 'Auto-detect' },
        { value: 'encode', label: 'Encode' },
        { value: 'decode', label: 'Decode' },
      ],
      default: 'auto',
    },
    {
      key: 'encodeAll',
      label: 'Encode all printable non-ASCII too',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'Encode',
      input: '<script>alert("x")</script> & done',
    },
    {
      title: 'Decode',
      input: 'Tom &amp; Jerry &mdash; caf&eacute; &#169;',
    },
  ],
  faq: [
    {
      q: 'When is auto-detect used?',
      a: 'If the text contains &-entities such as &amp;, &#65; or &eacute;, it decodes; if it contains raw <, > or & it encodes. Force a direction with the mode option when a string has both.',
    },
    {
      q: 'What does Encode do exactly?',
      a: 'Replaces & < > " and \' with their named entities, and apostrophes/quotes as configured. With "Encode all printable non-ASCII" it also turns é, ≤ and similar into numeric entities — handy when the target charset is ASCII-only.',
    },
    {
      q: 'Which entities can be decoded?',
      a: 'All named HTML4 entities (&amp;, &copy;, &eacute;, &nbsp; and the rest), numeric decimal and hexadecimal forms (&#169;, &#x00A9;), and any HTML5 entity. Unknown fragments are left untouched.',
    },
    {
      q: 'Is the result valid to paste anywhere?',
      a: 'The encode output is valid HTML text. The decode output is always plain text. Both are safe to copy into any editor.',
    },
  ],
  related: [  "unicode-escape",
  "url-encode",
  "json-escape",
  "string-escape"],
  status: 'stable',
};
