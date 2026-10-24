import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'html-to-text',
  name: 'HTML to Plain Text',
  category: 'developer',
  summary:
    'Strip HTML tags to clean, readable plain text — entities decoded, block layout preserved.',
  description:
    'Convert an HTML fragment or document to plain text with a pure string tokenizer (no DOM). Script and style contents are dropped, block elements become line breaks, list items get a dash, and HTML entities are decoded.',
  keywords: [
    'html to text',
    'strip html',
    'remove html tags',
    'html to plain text',
    'extract text',
    'decode entities',
    'un-html',
    'plain text',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'preserveLinks',
      label: 'Keep link URLs',
      type: 'boolean',
      default: false,
      help: 'Render <a> as "text (href)" instead of just the link text.',
    },
    {
      key: 'preserveImages',
      label: 'Keep image alt text',
      type: 'boolean',
      default: false,
      help: 'Render <img alt="…"> as "[alt]" instead of dropping it.',
    },
  ],
  examples: [
    {
      title: 'Heading and paragraph',
      input: '<h1>Title</h1><p>Hello <b>world</b></p>',
    },
    {
      title: 'List with entities',
      input: '<ul><li>Tom &amp; Jerry</li><li>Salt &#38; Pepper</li></ul>',
    },
    {
      title: 'Keep the link URL',
      input: '<p>See <a href="https://example.com">our site</a>.</p>',
      options: { preserveLinks: true },
    },
  ],
  faq: [
    {
      q: 'Does it use the browser DOM parser?',
      a: 'No. It is a small pure-JS tokenizer, so it runs the same in a Web Worker or a test and never executes the HTML.',
    },
    {
      q: 'Which entities are decoded?',
      a: 'A common named set (&amp; &lt; &nbsp; &copy; &mdash; …) plus every numeric entity, both decimal (&#169;) and hex (&#xA9;).',
    },
    {
      q: 'What happens to <script> and <style>?',
      a: 'Their contents are removed entirely before any text is extracted.',
    },
  ],
  article: [
    {
      heading: 'A tokenizer, not a browser',
      body: 'The conversion is one ordered pass of string rules: HTML comments go first, then script and style blocks with their contents, then the optional link and image rewrites, then structural tags become line breaks, and only afterwards are entities decoded. Nothing is rendered, no DOM is created and no script in the input ever executes, so the result is the same in a worker or a test as in the page.',
    },
    {
      heading: 'How layout survives the trip',
      body: 'Structural tags map to whitespace rather than being dropped: <br> becomes a newline, each <li> starts a line prefixed with "- ", and closing p, div, h1\u2013h6 and tr tags become a blank line. Runs of spaces and tabs collapse to one, lines are trimmed, and three or more blank lines shrink to one.',
    },
    {
      heading: 'The two optional keepers',
      body: 'By default links contribute only their visible text and images disappear. Turning on keep link URLs rewrites <a href> as "link text (https://…)", and keep image alt text turns <img alt="…"> into "[alt text]". An image with an empty or missing alt still vanishes even with that option on.',
    },
    {
      heading: 'What it will not decode',
      body: 'Numeric entities decode for any code point up to U+10FFFF, but named entities come from a fixed list, so an unrecognised name is left as written. Input over 500,000 characters is rejected rather than truncated, and an unclosed tag simply falls through the final strip step. The whole pass is local string work with no network request and no script execution.',
    },
  ],
  related: ['markdown-to-html', 'html-entities', 'xml-format', 'sql-format'],
  status: 'stable',
};
