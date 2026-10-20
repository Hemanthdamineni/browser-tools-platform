import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'markdown-toc',
  name: 'Markdown Table of Contents',
  category: 'text',
  summary:
    'Generate a nested table of contents from Markdown headings, with GitHub-compatible slugs and links.',
  description:
    'Paste any Markdown document and get a nested table of contents generated from its ATX headings (# to ######). Anchors use GitHub-compatible slugs, custom {#anchor} targets are honoured, fenced code blocks are skipped, and output can be GitHub-style bullet links, a plain indented list, or nested HTML. Fully on-device.',
  keywords: [
    'markdown table of contents',
    'markdown toc',
    'toc generator',
    'heading outline',
    'github anchor',
    'slug generator',
    'markdown headings',
    'document outline',
    'readme toc',
    'markdown navigation',
    'anchor links',
    'heading list',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'depth',
      label: 'Maximum heading depth',
      type: 'number',
      default: 6,
      min: 1,
      max: 6,
      step: 1,
    },
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      default: 'github',
      choices: [
        { value: 'github', label: 'GitHub-style links (- [Title](#slug))' },
        { value: 'plain', label: 'Plain indented list' },
        { value: 'html', label: 'Nested HTML list' },
      ],
    },
  ],
  examples: [
    {
      title: 'Nested document',
      input:
        '# Getting Started\n## Install\n### Windows\n## Run\n# API Reference\n## Configuration',
      options: {},
    },
    {
      title: 'Custom anchors and code fences',
      input: '# Title {#custom}\n```\n# This is code, not a heading\n```\n## Real Heading',
      options: { format: 'plain' },
    },
  ],
  faq: [
    {
      q: 'Which heading syntax is supported?',
      a: 'ATX headings: a line starting with 1–6 # characters followed by a space (or a #-only line is treated as empty and skipped). Setext underlines are not expanded; if your document uses them, convert the top-level titles to # first.',
    },
    {
      q: 'How are the anchors generated?',
      a: 'With the GitHub convention: lowercase, keep letters/digits/underscores/hyphens, drop punctuation, turn whitespace into single hyphens. An explicit {#custom} at the end of a heading overrides the slug and is removed from the link text.',
    },
    {
      q: 'Are code blocks ignored?',
      a: 'Yes. Headings inside fenced code blocks (``` on both sides) are not included, so example documents that show hashtags stay out of the outline.',
    },
    {
      q: 'Should tables of contents be limited by depth?',
      a: 'Most READMEs link h1–h3. The depth option lets you cap how deep the outline goes — useful when h4+ headings are implementation notes you do not want to navigate.',
    },
  ],
  related: ['markdown-table', 'markdown-to-html', 'html-to-text', 'text-stats'],
  status: 'stable',
};
