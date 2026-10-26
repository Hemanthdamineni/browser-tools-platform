/**
 * Editorial content for the markdown-preview tool page.
 *
 * Kept out of ``markdown-preview.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'A split-pane editor, not a converter',
      body: 'Type Markdown on the left and the rendered document updates on the right as you go — headings, tables, task lists, links and fenced code all appear live. It is a workbench: keep a README open while you edit, then copy the HTML or print to PDF.',
    },
    {
      heading: 'The switches that change the render',
      body: 'GitHub Flavored Markdown adds tables, strikethrough, task lists and autolinks; turn it off for strict CommonMark. “Convert single line breaks to <br>” makes every newline a hard break. Heading ids are slugged so anchors work, and highlighting can be switched off. The code theme and preview theme are independent.',
    },
    {
      heading: 'Export and print',
      body: 'The HTML export writes a self-contained document styled to match the preview theme, and the Print / Save as PDF button opens your browser’s own print dialog. The printed page is the rendered document, not the editor. The export carries the same content-security policy as the preview, so remote images stay out.',
    },
    {
      heading: 'Sanitisation and raw HTML',
      body: 'Raw HTML is filtered before it is written anywhere: scripts, frames, embedded objects, form tags, event-handler attributes and javascript: and data: URLs are stripped, and the preview renders inside a sandboxed frame that cannot run scripts or reach this page.',
    },
    {
      heading: 'Everything happens in this tab',
      body: 'The document is parsed locally with marked, highlighted with shiki, and never sent anywhere. The preview runs under a Content-Security-Policy that blocks remote requests, so a pasted document cannot load a tracking pixel. Nothing is stored between visits.',
    },
  ],
  faq: [
    {
      q: 'Is my Markdown uploaded anywhere?',
      a: 'No. The document is parsed in this tab and never leaves your device. The preview even runs with a Content-Security-Policy that blocks every remote request, so a document cannot phone home either.',
    },
    {
      q: 'What happens to raw HTML in my Markdown?',
      a: 'The live preview renders inside a sandboxed frame that cannot run scripts and cannot reach this page, and the markup is filtered before it is written there. The exported file, the copied HTML and the printed page go through the same filter: scripts, frames, embedded objects, form tags, event-handler attributes and javascript:/data: URLs are removed.',
    },
    {
      q: 'Why do remote images not show up?',
      a: 'The preview and the exported file both carry a content-security policy that only allows inline data, so a pasted document cannot load a remote asset or a tracking pixel. The exported file is therefore completely offline — edit it if you want the images back.',
    },
    {
      q: 'Which Markdown dialect is used?',
      a: 'CommonMark via the marked library, with the GitHub Flavored Markdown extensions (tables, strikethrough, task lists, autolinks) when the GFM switch is on.',
    },
    {
      q: 'How do I get a PDF?',
      a: 'Press "Print / Save as PDF". Your browser opens its own print dialog; choose "Save as PDF" as the destination. The printed page is the rendered document, not the editor.',
    },
    {
      q: 'Which languages can be highlighted?',
      a: 'The common ones — JavaScript, TypeScript, JSX/TSX, Python, Bash, JSON, YAML, HTML, CSS, SCSS, Markdown, SQL, XML, Diff and Dockerfiles. Anything else is shown as plain, unhighlighted code.',
    },
  ],
} as const;
