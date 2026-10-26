/**
 * Editorial content for the markdown-to-html tool page.
 *
 * Kept out of ``markdown-to-html.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
