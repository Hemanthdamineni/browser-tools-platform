import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'markdown-toc',
  name: 'Markdown Table of Contents',
  category: 'developer',
  summary: 'Generate a Markdown table of contents from headings, with matching anchor links.',
  description:
    'Extract Markdown headings and generate an indented table of contents. Fenced code blocks are ignored, duplicate headings receive numbered anchors, and link slugs match the project’s Markdown-to-HTML heading ID option. Processing stays in your browser.',
  keywords: [
    'markdown toc',
    'markdown table of contents',
    'md toc generator',
    'heading links',
    'markdown headings',
    'github markdown toc',
    'generate contents',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  examples: [
    {
      title: 'Nested headings',
      input: '# Guide\n\n## Install\n\n### Requirements\n\n## Usage',
    },
    {
      title: 'Duplicate headings',
      input: '# Overview\n\n## Overview\n\n## Overview',
    },
    {
      title: 'Inline formatting',
      input: '# **Getting Started**\n\n## Install `tool`',
    },
  ],
  faq: [
    {
      q: 'Are headings inside code blocks included?',
      a: 'No. The Markdown lexer identifies code blocks separately, so their contents are never treated as headings.',
    },
    {
      q: 'How are heading links generated?',
      a: 'Links use the same lowercase, punctuation-removing slug rules as the Markdown-to-HTML tool’s heading ID option. Duplicate slugs get -1, -2 and so on.',
    },
    {
      q: 'What heading styles are detected?',
      a: 'Both ATX headings (# Heading) and Setext headings (underlined with === or ---) are recognized by the Markdown parser.',
    },
  ],
  related: ['markdown-to-html', 'slugify', 'html-to-text'],
  credits: [{ name: 'marked', url: 'https://github.com/markedjs/marked', license: 'MIT' }],
  status: 'stable',
};
