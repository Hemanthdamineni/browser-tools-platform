import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'markdown-to-html',
  name: 'Markdown to HTML',
  category: 'developer',
  summary: 'Convert Markdown to HTML source code — see the generated markup, not a preview.',
  description:
    'Render Markdown to HTML and show the resulting source so you can copy it into a template, email, or CMS. Toggle GitHub Flavored Markdown, hard line breaks, and slugged heading IDs.',
  keywords: [
    'markdown',
    'md',
    'markdown to html',
    'md to html',
    'commonmark',
    'gfm',
    'github flavored markdown',
    'convert markdown',
    'render markdown',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'gfm',
      label: 'GitHub Flavored Markdown',
      type: 'boolean',
      default: true,
      help: 'Enable tables, strikethrough, task lists and autolinks.',
    },
    {
      key: 'breaks',
      label: 'Convert single line breaks to <br>',
      type: 'boolean',
      default: false,
      help: 'Treat every newline inside a paragraph as a hard break.',
    },
    {
      key: 'headerIds',
      label: 'Add id="" to headings',
      type: 'boolean',
      default: false,
      help: 'Give each heading a slugified id for anchor links.',
    },
  ],
  examples: [
    { title: 'Heading and paragraph', input: '# Title\n\nHello **world**.' },
    {
      title: 'GFM strikethrough',
      input: 'This is ~~struck~~ text.',
      options: { gfm: true },
    },
    {
      title: 'Headings with ids',
      input: '# Getting Started\n\n## Install Steps',
      options: { headerIds: true },
    },
  ],
  related: ['html-to-text', 'html-entities', 'slugify', 'sql-format'],
  credits: [{ name: 'marked', url: 'https://github.com/markedjs/marked', license: 'MIT' }],
  status: 'stable',
};
