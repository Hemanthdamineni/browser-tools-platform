import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'html-to-markdown',
  name: 'HTML to Markdown',
  category: 'developer',
  summary:
    'Convert an HTML snippet or page into clean Markdown, on device, no server.',
  description:
    'Turn HTML into readable Markdown for docs, wikis, and migration work. Handles headings, paragraphs, ordered and unordered lists, bold/italic/strikethrough, links (inline or reference style), images, fenced code blocks, blockquotes, horizontal rules, and line breaks. Inline style blocks and scripts are dropped, and entities are decoded — all client-side, so nothing leaves the browser.',
  keywords: [
    'html to markdown',
    'html converter',
    'markdown generator',
    'html to md',
    'html table to markdown',
    'web to markdown',
    'html sanitizer',
    'pandoc',
    'html extract text',
    'html to md converter',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'linkStyle',
      label: 'Link style',
      type: 'select',
      default: 'inline',
      choices: [
        { value: 'inline', label: 'Inline  [text](url)' },
        { value: 'reference', label: 'Reference  [text][1]' },
        { value: 'text', label: 'Text only (drop urls)' },
      ],
    },
    {
      key: 'headingStyle',
      label: 'Heading style',
      type: 'select',
      default: 'atx',
      choices: [
        { value: 'atx', label: 'ATX  # Heading' },
        { value: 'setext', label: 'Setext  = / -' },
      ],
    },
  ],
  examples: [
    {
      title: 'Article snippet',
      input:
        '<h2>Hello</h2>\n<p>This is <strong>bold</strong> and <em>italic</em>.</p>\n<ul>\n<li>One</li>\n<li>Two</li>\n</ul>',
      options: {},
    },
    {
      title: 'With a link and code',
      input:
        '<h1>Docs</h1>\n<p>Read the <a href="https://example.com">guide</a> and run <code>npm install</code>.</p>',
      options: { linkStyle: 'reference' },
    },
  ],
  faq: [
    {
      q: 'Is it lossy?',
      a: 'It targets content, not layout. Attributes like class and id are dropped, and unsupported elements fall back to their text content. Tables are converted to a plain table using pipe separators.',
    },
    {
      q: 'What about script and style blocks?',
      a: 'Both are removed entirely, along with HTML comments, so the result stays clean and focused on the visible content.',
    },
    {
      q: 'How are links handled?',
      a: 'Inline style produces [text](url). Reference style collects unique urls into numbered references at the end, which keeps long urls out of the text. Text-only drops urls and keeps the anchor text.',
    },
    {
      q: 'Can I convert a whole page?',
      a: 'Yes, paste the whole document. Only the body-style content is used; <head>, script, style, and comments are ignored.',
    },
  ],
  related: ['markdown-to-html', 'html-to-text', 'markdown-toc', 'csv-to-html', 'json-diff'],
  status: 'stable',
};
