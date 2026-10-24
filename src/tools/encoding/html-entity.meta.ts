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
  article: [
    {
      heading: 'Encode and decode, two directions',
      body: 'This tool converts text to HTML entities or back again. Encoding turns the characters that break HTML markup — &, <, >, and the quotes — into their named entities, so pasted text cannot close a tag or inject a script. Decoding takes &amp;, &lt;b&gt;, &eacute;, &copy; and numeric forms like &#169; or &#x00A9; back to real characters. The mode is usually detected automatically from which kind of string you pasted.',
    },
    {
      heading: 'When each direction helps',
      body: 'Encode before you drop user-supplied or copied text into a page, a template or an email where it would otherwise be parsed as markup. Decode when you received an entity-laden string — an RSS feed, an old export, a caption with &mdash; or &nbsp; — and you want the plain text it represents. The encodeAll switch goes further and also turns every printable non-ASCII character into a numeric entity, which is handy for an ASCII-only target charset.',
    },
    {
      heading: 'How auto-detect decides',
      body: 'If the text contains entity-looking fragments such as &amp;, &#65; or &eacute; it decodes; if it contains raw <, > or & it encodes. A string that has both kinds is ambiguous, so the mode option lets you force the direction rather than guess. Unknown entity names and malformed fragments are left untouched rather than destroyed, so decoding is safe on text you are not sure about.',
    },
    {
      heading: 'Scope of the tables',
      body: 'Encoding covers the five characters that make HTML unsafe plus apostrophes, and optionally all printable non-ASCII as numeric entities. Decoding understands the full HTML4 named set plus HTML5 entities and both decimal and hexadecimal numeric forms, so the common cases and the obscure ones are both handled in this tab with no network lookup.',
    },
    {
      heading: 'Nothing is uploaded',
      body: 'Both directions run entirely on your device. The text you convert never leaves this tab, so you can safely encode a snippet you do not want a hosted converter to see, and the tool works offline.',
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
  faq: [
    {
      q: 'When is auto-detect used?',
      a: 'If the text contains &-entities such as &amp;, &#65; or &eacute;, it decodes; if it contains raw <, > or & it encodes. Force a direction with the mode option when a string has both.',
    },
    {
      q: 'What does Encode do exactly?',
      a: "Replaces & < > \" and ' with their named entities, and apostrophes/quotes as configured. With \"Encode all printable non-ASCII\" it also turns é, ≤ and similar into numeric entities — handy when the target charset is ASCII-only.",
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
  related: ['unicode-normalize', 'url-encode', 'text-to-binary', 'string-escape'],
  status: 'stable',
};
