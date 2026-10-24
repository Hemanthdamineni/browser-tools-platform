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
  faq: [
    {
      q: 'Does this preview the HTML?',
      a: 'No. It deliberately shows the HTML source as text so you can copy it. Nothing is rendered as a live page.',
    },
    {
      q: 'Which Markdown dialect is used?',
      a: 'CommonMark via the marked library, with optional GitHub Flavored Markdown extensions when the GFM toggle is on.',
    },
    {
      q: 'Why are heading ids off by default?',
      a: 'Plain marked output has no ids. Turn on "Add id to headings" to get slugified anchors like id="install-steps".',
    },
  ],
  article: [
    {
      heading: 'Markdown turned into markup source',
      body: 'Paste Markdown and the tool renders it to HTML and shows the generated markup as text you can copy, rather than a live preview. The result is what you would paste into a template, an email, a CMS field or a static site build. It is built on the marked parser, which is CommonMark-compliant out of the box, and three toggles extend or adjust the output: GitHub Flavored Markdown, hard line breaks and slugged heading ids.',
    },
    {
      heading: 'What the GitHub Flavored Markdown toggle adds',
      body: 'With the GFM option on, the renderer switches on the extensions people expect from GitHub and most markdown-first editors: tables built from pipes, strikethrough with doubled tildes, task lists with square-bracket markers, and autolinks that turn bare URLs into anchor tags. Leave it off and those syntaxes are treated as plain CommonMark, which matters when your target renderer only speaks the core dialect.',
    },
    {
      heading: 'The two rendering toggles',
      body: 'Hard line breaks makes every single newline inside a paragraph a <br> tag, the way many chat and email clients format Markdown, instead of folding consecutive lines into one paragraph — turn it on when your source is one line per sentence. Heading ids, off by default, gives every heading a slugified id attribute such as id="install-steps" so in-page anchor links work; it is off by default because plain marked output writes no ids, and you may not want them in every context.',
    },
    {
      heading: 'What you see versus what you get',
      body: 'Because the output is the source, nothing is executed: raw HTML in your Markdown passes through and is shown literally rather than rendered, so copy it somewhere safe before embedding. The tool deliberately offers no live preview, so the HTML you copy is exactly the text on screen. All rendering is a pure text conversion inside your browser — the Markdown you paste never leaves it, and no request is made.',
    },
  ],
  related: ['html-to-text', 'html-entities', 'slugify', 'sql-format'],
  credits: [{ name: 'marked', url: 'https://github.com/markedjs/marked', license: 'MIT' }],
  status: 'stable',
};
