import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'markdown-link-checker',
  name: 'Markdown Link Checker',
  category: 'developer',
  summary: 'Check Markdown links and anchors: broken fragments, missing references, empty URLs.',
  description:
    'Scan a Markdown document for link and anchor problems before you publish. Detects broken local fragments (links to headings that do not exist), duplicate heading anchors, reference-style links whose definition is missing or unused, empty link labels or targets, and auto-links that are malformed. External web links are counted and reported as unchecked rather than fetched, keeping everything on-device.',
  keywords: [
    'markdown link checker',
    'broken anchors',
    'markdown lint',
    'check links',
    'dead links markdown',
    'fragment check',
    'link validator',
    'markdown linting',
    'heading anchor',
    'reference link check',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'checkExternal',
      label: 'Report external web links',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Document with a broken anchor',
      input: '# Intro\n\nSee [details](#details) below.\n\n## Details\n\nText.',
      options: {},
    },
    {
      title: 'Missing reference definition',
      input: 'Read the [guide][guide-ref].\n\n## Guide\n\nMore.',
      options: {},
    },
    {
      title: 'Heading anchor that works',
      input: '# My Notes\n\nJump to [my notes](#my-notes) above.',
      options: { checkExternal: false },
    },
  ],
  related: [
    'markdown-toc',
    'markdown-to-html',
    'html-to-markdown',
    'json-diff',
    'subtitle-converter',
  ],
  status: 'stable',
};
