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
  article: [
    {
      heading: 'What it checks, and what it only counts',
      body: 'The document is scanned line by line and a findings table is produced with Status, Kind, Label, Target and Line. Structural problems are actually validated: a link to #fragment with no matching heading, an empty target or label, a reference-style link with no definition, a definition nothing links to, and malformed autolinks. Web links such as https: and mailto: are only counted and listed as unchecked, because nothing is fetched.',
    },
    {
      heading: 'Why anchors are slugified like GitHub',
      body: 'Local fragments use the rule GitHub applies to heading ids: lowercase, strip punctuation and collapse spaces or dashes, so "My Notes!" matches #my-notes. Explicit anchors in braces, {#custom}, are honoured too, the same convention as the markdown table-of-contents tool.',
    },
    {
      heading: 'Severity levels and code skipping',
      body: 'A missing definition, empty target or broken fragment is an error; unused definitions, duplicate anchors and malformed autolinks are warnings; external links are informational since nothing was requested. Every row carries its line number. Links inside fenced or indented code are ignored, so example URLs in snippets do not raise false alarms.',
    },
    {
      heading: 'Your draft never leaves the page',
      body: 'Everything is checked with text processing in this tab. No URL is requested and no document is uploaded, and the external-link option only decides whether those links are listed in the report, never whether they are fetched.',
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
  related: [
    'markdown-toc',
    'markdown-to-html',
    'html-to-markdown',
    'json-diff',
    'subtitle-converter',
  ],
  status: 'stable',
};
