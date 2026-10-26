/**
 * Editorial content for the code-minify tool page.
 *
 * Kept out of ``code-minify.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the Code Minifier does',
      body: 'Paste JavaScript, TypeScript, CSS, HTML or JSON and the tool returns the minified text plus input bytes, output bytes, bytes saved and percent saved. JavaScript and CSS go through Terser and csso, HTML through html-minifier-terser, JSON is compacted, and TypeScript is stripped to plain JavaScript first.',
    },
    {
      heading: 'When to reach for it',
      body: 'Use it when a bundle, stylesheet or page needs to ship smaller and you want to eyeball the result before wiring a build step. It is also handy for checking how much a snippet would shrink, since the byte figures come from the same run.',
    },
    {
      heading: 'Choosing a language and compression level',
      body: 'Language defaults to Auto-detect, which reads the input and picks a minifier without loading one. Compression defaults to Safe, removing only whitespace, comments and redundancy; Aggressive renames identifiers, drops unused top-level code and assumes a modern browser, so use it for build output rather than code you read by hand. If Auto-detect finds TypeScript while you chose JavaScript, it points at the TypeScript option instead of a syntax error.',
    },
    {
      heading: 'Where minification stops',
      body: 'JSX and Vue single-file components cannot be minified here, because JSX has to be compiled and a single-file component mixes three languages. Broken HTML tags and CSS with nested selectors or empty declaration values raise readable errors rather than emitting broken output.',
    },
    {
      heading: 'Where your code goes',
      body: 'Every minifier runs in this tab; the library files are downloaded from this same site on first use, and your pasted code is never uploaded.',
    },
  ],
  faq: [
    {
      q: 'Does my code leave the browser?',
      a: 'No. Every minifier runs in this tab. The minifier files are downloaded from this same site the first time you use them, and your input is never uploaded.',
    },
    {
      q: 'Why did the first run take a moment?',
      a: 'The minifier for the language you picked is only downloaded when you first use it. Later runs reuse what is already loaded, so they are almost instant.',
    },
    {
      q: 'What is the difference between Safe and Aggressive?',
      a: 'Safe only removes whitespace, comments and other redundancy. Aggressive also renames local and top-level identifiers, drops unused top-level code and applies optimisations that assume a modern browser — so use it for build output, not for code you read by hand.',
    },
    {
      q: 'Does it handle TypeScript?',
      a: 'Yes. Type annotations, interfaces, enums, generics and namespaces are stripped first, then the JavaScript is minified. The result is plain JavaScript.',
    },
    {
      q: 'Can it minify JSX or Vue files?',
      a: 'No. JSX has to be compiled before it can be minified, and a single-file component mixes three languages. Transform them to plain JavaScript or plain HTML first.',
    },
    {
      q: 'Is the byte count gzipped?',
      a: 'No, it is the raw size of the text in UTF-8 bytes, before and after minifying. Gzip would shrink both numbers further, but by a different amount.',
    },
  ],
} as const;
