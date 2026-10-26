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
  related: ['markdown-to-html', 'html-entities', 'xml-format', 'sql-format'],
  status: 'stable',
};
