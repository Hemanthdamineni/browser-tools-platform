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
  article: [
    {
      heading: 'What encoding is for',
      body: 'In HTML, characters like < > & and " are markup, not text. Escape mode rewrites them as entities — &amp; &lt; &gt; &quot; and &#39; — so a string is displayed exactly as written instead of being parsed as a tag or an attribute break. This is the same work as htmlspecialchars or an HTML-escape helper, and it is the plain, correct way to render user-provided text inside a page.',
    },
    {
      heading: 'Two encoding levels',
      body: 'Minimal touches only the five characters that matter for markup safety: & < > " and the apostrophe. Minimal plus all non-ASCII additionally converts every character above code point 127 to a numeric reference such as &#8212;, which keeps the result pure ASCII for systems that mangle UTF-8 — handy for email templates and legacy pipelines, at the cost of larger, less readable output.',
    },
    {
      heading: 'Decoding back to text',
      body: 'Decode mode walks the string and resolves named references from a set of about 250 common names (amp, copy, mdash, alpha, rarr and so on) plus any decimal &#NN; or hexadecimal &#xNN; reference. A reference outside the valid Unicode range, or an unknown name, is left exactly as it was rather than replaced with a question mark, so nothing is silently corrupted.',
    },
    {
      heading: 'Caveats and privacy',
      body: 'Decoding covers the common named set, not every entity in the full HTML table, so rare names pass through unchanged; encoding is the direction you should rely on for safety. Escaping is a display concern, not a substitute for proper input handling elsewhere. Both directions run in the page with no request, so text pasted from a private page is never uploaded.',
    },
  ],
  examples: [
    { title: 'Escape a tag', input: '<a href="#">Tom & Jerry</a>', options: { mode: 'encode' } },
    {
      title: 'Decode',
      input: '5 &lt; 10 &amp;&amp; 10 &gt; 5 &#8212; ok',
      options: { mode: 'decode' },
    },
    {
      title: 'Escape for an ASCII-only template',
      input: 'Café — €5',
      options: { mode: 'encode', level: 'non-ascii' },
    },
  ],
  faq: [
    {
      q: 'Does decoding cover every named entity?',
      a: 'It covers the common set (about 250 names) plus all decimal (&#NN;) and hex (&#xNN;) references. Rare names fall through unchanged.',
    },
    {
      q: 'Which characters does minimal encode?',
      a: 'Only the five that matter inside HTML: ampersand, less-than, greater-than, double quote and the apostrophe (as &#39;). Everything else is left alone so the output stays readable.',
    },
    {
      q: 'When would I use "Minimal + all non-ASCII"?',
      a: 'When the result must survive a channel that mangles UTF-8 — an email template or an older pipeline. Every character above code point 127 becomes a numeric reference, so the whole string is plain ASCII.',
    },
    {
      q: 'Is my text sent anywhere?',
      a: 'No. Encoding and decoding both run in your browser with no request and no upload, so the page works offline.',
    },
  ],
  related: ['url-encode', 'unicode-lookup', 'string-escape', 'html-to-text'],
  status: 'stable',
};
