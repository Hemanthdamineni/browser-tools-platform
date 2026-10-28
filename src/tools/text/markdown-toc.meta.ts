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
    {
      title: 'Nested HTML list capped at h3',
      input: '# Intro\n## Setup\n### Install\n#### Tuning\n# Reference',
      options: { format: 'html', depth: 3 },
    },
  ],
  related: ['markdown-table', 'markdown-to-html', 'html-to-text', 'text-stats'],
  status: 'stable',
};
