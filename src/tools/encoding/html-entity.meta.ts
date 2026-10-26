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
    {
      title: 'Force encoding of a mixed string',
      input: '5 < 6 & 7 > 4',
      options: { mode: 'encode' },
    },
  ],
  related: ['unicode-normalize', 'url-encode', 'text-to-binary', 'string-escape'],
  status: 'stable',
};
