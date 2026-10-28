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
  ],
  faq: [
    {
      q: 'Will it fetch external web links to check them?',
      a: 'No. Everything runs on-device. External links like https://… or mailto:… are listed as unchecked; only structure inside your document (headings, fragments, reference definitions) is validated.',
    },
    {
      q: 'How are heading anchors computed?',
      a: 'With the GitHub slug rule: lowercase, remove punctuation, collapse spaces/dashes. Custom anchors written as {#custom} are honored too, matching the markdown-toc tool.',
    },
    {
      q: 'What is a broken fragment?',
      a: 'A local link like #details that points to a heading or custom anchor that does not exist in the document, or a #anchor with no matching heading.',
    },
    {
      q: 'Are code blocks skipped?',
      a: 'Yes. Links inside fenced code blocks (``` and ~~~) and indented code are ignored so example URLs in snippets do not trigger false alarms.',
    },
  ],
  related: [  "markdown-toc",
  "markdown-to-html",
  "html-to-markdown",
  "json-diff",
  "subtitle-converter"],
  status: 'stable',
};
